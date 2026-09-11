###### Start Backend

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
_________________________________________

## 📁Frontend Start

```bash
cd frontend
npm run dev
```
__________________________________________

## 📁 Test Script Run

```bash
# Standard run (Side-by-Side: 1. Original Raw | 2. Preprocessed + AI Detections)
python test_run.py

# Custom confidence, box padding, and input/output dirs
python test_run.py --input Test_Data --output outputs --conf 0.25 --pad 12

# Run with an external navigation GPS log for full WGS84 mapping
python test_run.py --nav nav_log.csv --altitude 8.5 --swath 120.0

# Save individual raw, enhanced, and side-by-side composite images
python test_run.py --save-both
```