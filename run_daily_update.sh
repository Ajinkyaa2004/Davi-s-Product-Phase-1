#!/bin/bash

# Navigate to the project directory to ensure relative paths work
cd "/Users/ajinkya/Desktop/Davi Product"

# Log the start time
echo "----------------------------------------" >> etl_log.txt
echo "Starting ETL at $(date)" >> etl_log.txt

# Run the Python script using the virtual environment's Python
# Using --all to fetch both historical (yesterday's results) and upcoming (next 15 days)
./.venv/bin/python football_data_fetcher.py --all >> etl_log.txt 2>&1

# Log the end time
echo "Finished ETL at $(date)" >> etl_log.txt
echo "----------------------------------------" >> etl_log.txt
