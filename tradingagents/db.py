import sqlite3
import json
import logging
from pathlib import Path
from tradingagents.default_config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)

def get_db_path() -> Path:
    # We will place the database in the results_dir
    db_dir = Path(DEFAULT_CONFIG.get("results_dir"))
    db_dir.mkdir(parents=True, exist_ok=True)
    return db_dir / "reports.db"

def init_db():
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            ticker TEXT,
            date TEXT,
            report_data TEXT,
            PRIMARY KEY (ticker, date)
        )
    ''')
    conn.commit()
    conn.close()

def save_report(ticker: str, date: str, report_dict: dict):
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO reports (ticker, date, report_data)
        VALUES (?, ?, ?)
    ''', (ticker, date, json.dumps(report_dict)))
    conn.commit()
    conn.close()
    logger.info(f"Saved database report for {ticker} on {date}")

def get_report(ticker: str, date: str) -> dict:
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute('SELECT report_data FROM reports WHERE ticker = ? AND date = ?', (ticker, date))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None

def list_reports() -> dict:
    """Returns a dict mapping ticker -> list of dates (sorted descending)"""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    # Check if table exists first (in case it's called before init_db)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reports'")
    if not cursor.fetchone():
        conn.close()
        return {}
        
    cursor.execute('SELECT ticker, date FROM reports ORDER BY date DESC')
    rows = cursor.fetchall()
    conn.close()
    
    reports = {}
    for ticker, date in rows:
        if ticker not in reports:
            reports[ticker] = []
        reports[ticker].append(date)
    return reports

def report_exists(ticker: str, date: str) -> bool:
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reports'")
    if not cursor.fetchone():
        conn.close()
        return False
        
    cursor.execute('SELECT 1 FROM reports WHERE ticker = ? AND date = ?', (ticker, date))
    row = cursor.fetchone()
    conn.close()
    return bool(row)
