"""
backend/system_info.py
Utility to detect actual host hardware specifications (CPU, RAM, GPU)
"""
from __future__ import annotations

import json
import os
import platform
import subprocess
from typing import Any, Dict, List, Optional
import psutil


def get_hardware_info() -> Dict[str, Any]:
    logical_cores = psutil.cpu_count(logical=True) or 8
    physical_cores = psutil.cpu_count(logical=False) or 4
    
    vm = psutil.virtual_memory()
    ram_total_gb = round(vm.total / (1024**3), 1)
    ram_available_gb = round(vm.available / (1024**3), 1)

    cpu_name = platform.processor() or "Multi-Core Processor"
    gpus: List[Dict[str, Any]] = []

    if platform.system() == "Windows":
        # Extract CPU friendly name on Windows via winreg (instantaneous)
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            proc_str, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            if proc_str:
                cpu_name = proc_str.strip()
        except Exception:
            pass

        # Extract GPU list and VRAM on Windows
        try:
            cmd = [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json",
            ]
            gpu_json = subprocess.check_output(cmd, text=True, timeout=3).strip()
            if gpu_json:
                gpus_data = json.loads(gpu_json)
                if isinstance(gpus_data, dict):
                    gpus_data = [gpus_data]
                for g in gpus_data:
                    name = g.get("Name")
                    vram_bytes = g.get("AdapterRAM")
                    vram_gb = (
                        round(vram_bytes / (1024**3), 1)
                        if vram_bytes and isinstance(vram_bytes, (int, float)) and vram_bytes > 0
                        else None
                    )
                    if name:
                        gpus.append({"name": name, "vram_gb": vram_gb})
        except Exception:
            pass
    elif platform.system() == "Linux":
        try:
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        cpu_name = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass

    # Determine primary GPU (prefer dedicated NVIDIA / AMD / Intel Arc)
    primary_gpu = None
    vram_gb = None
    if gpus:
        # Prioritize dedicated NVIDIA or AMD discrete GPUs
        dedicated = [
            g for g in gpus if any(k in g["name"].upper() for k in ["NVIDIA", "RTX", "GTX", "RADEON RX", "ARC"])
        ]
        chosen = dedicated[0] if dedicated else gpus[0]
        primary_gpu = chosen["name"]
        vram_gb = chosen["vram_gb"]

    return {
        "cpu_name": cpu_name,
        "physical_cores": physical_cores,
        "logical_cores": logical_cores,
        "ram_total_gb": ram_total_gb,
        "ram_available_gb": ram_available_gb,
        "gpus": gpus,
        "primary_gpu": primary_gpu,
        "vram_gb": vram_gb,
    }


# Cache static hardware info for instantaneous responses
_CACHED_HW_INFO: Optional[Dict[str, Any]] = None

def get_system_hardware_cached() -> Dict[str, Any]:
    global _CACHED_HW_INFO
    if _CACHED_HW_INFO is None:
        try:
            _CACHED_HW_INFO = get_hardware_info()
        except Exception:
            _CACHED_HW_INFO = {
                "cpu_name": "Multi-Core Processor",
                "physical_cores": 4,
                "logical_cores": 8,
                "ram_total_gb": 16.0,
                "ram_available_gb": 8.0,
                "gpus": [],
                "primary_gpu": None,
                "vram_gb": None,
            }
    # Update dynamic memory availability
    try:
        vm = psutil.virtual_memory()
        _CACHED_HW_INFO["ram_available_gb"] = round(vm.available / (1024**3), 1)
    except Exception:
        pass
    return _CACHED_HW_INFO
