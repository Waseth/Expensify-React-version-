from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_bcrypt import Bcrypt
import mysql.connector
from mysql.connector import Error
import os
from datetime import timedelta, datetime
import json
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'expensify-super-secret-key-2024')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

jwt = JWTManager(app)
bcrypt = Bcrypt(app)

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'database': os.environ.get('DB_NAME', 'expensify_db'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'port': int(os.environ.get('DB_PORT', 3306))
}

def get_db():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"Database connection error: {e}")
        return None

def init_db():
    conn = get_db()
    if not conn:
        print("Could not connect to database. Make sure MySQL is running.")
        return
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budget_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            monthly_allowance DECIMAL(12,2) DEFAULT 0,
            budget_locked BOOLEAN DEFAULT FALSE,
            split_percentage INT DEFAULT 50,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_month (user_id, month_year)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS week_budgets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            week_key VARCHAR(20) NOT NULL,
            allocated DECIMAL(12,2) DEFAULT 0,
            spent DECIMAL(12,2) DEFAULT 0,
            ended BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_month_week (user_id, month_year, week_key)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            category VARCHAR(20) NOT NULL,
            description VARCHAR(255) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            expense_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS income_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            account_type VARCHAR(20) NOT NULL,
            balance DECIMAL(12,2) DEFAULT 0,
            total_spent DECIMAL(12,2) DEFAULT 0,
            external_income_total DECIMAL(12,2) DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY unique_user_month_account (user_id, month_year, account_type)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS external_income (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            month_year VARCHAR(7) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            description VARCHAR(255),
            income_date DATE NOT NULL,
            split_percentage INT DEFAULT 50,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    cursor.close()
    conn.close()
    print("Database initialized successfully")

def get_current_month():
    return datetime.now().strftime('%Y-%m')

# ── AUTH ROUTES ──────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    conn = get_db()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE email = %s OR username = %s", (email, username))
        if cursor.fetchone():
            return jsonify({'error': 'Username or email already exists'}), 409

        pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
                      (username, email, pw_hash))
        conn.commit()
        user_id = cursor.lastrowid

        token = create_access_token(identity=str(user_id))
        return jsonify({'token': token, 'user': {'id': user_id, 'username': username, 'email': email}}), 201
    except Error as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    conn = get_db()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user or not bcrypt.check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = create_access_token(identity=str(user['id']))
        return jsonify({'token': token, 'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}})
    finally:
        cursor.close()
        conn.close()

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, email, created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.get('created_at'):
        user['created_at'] = user['created_at'].isoformat()
    return jsonify(user)

# ── BUDGET SETTINGS ───────────────────────────────────────────────────────────

@app.route('/api/budget/settings', methods=['GET'])
@jwt_required()
def get_budget_settings():
    user_id = int(get_jwt_identity())
    month_year = request.args.get('month', get_current_month())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM budget_settings WHERE user_id = %s AND month_year = %s",
                   (user_id, month_year))
    settings = cursor.fetchone()

    if not settings:
        settings = {'monthly_allowance': 0, 'budget_locked': False, 'split_percentage': 50, 'month_year': month_year}
    else:
        settings['monthly_allowance'] = float(settings['monthly_allowance'])
        settings['budget_locked'] = bool(settings['budget_locked'])

    cursor.execute("SELECT * FROM week_budgets WHERE user_id = %s AND month_year = %s",
                   (user_id, month_year))
    weeks_raw = cursor.fetchall()
    weeks = {}
    for w in weeks_raw:
        weeks[w['week_key']] = {
            'allocated': float(w['allocated']),
            'spent': float(w['spent']),
            'ended': bool(w['ended'])
        }

    default_weeks = ['fixed_week1', 'week2', 'week3', 'week4']
    for wk in default_weeks:
        if wk not in weeks:
            weeks[wk] = {'allocated': 0, 'spent': 0, 'ended': False}

    cursor.close()
    conn.close()
    return jsonify({'settings': settings, 'weeks': weeks})

@app.route('/api/budget/settings', methods=['POST'])
@jwt_required()
def update_budget_settings():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    monthly_allowance = float(data.get('monthly_allowance', 0))
    split_percentage = int(data.get('split_percentage', 50))
    week_allocations = data.get('week_allocations', {})
    leftover = float(data.get('leftover', 0))

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        INSERT INTO budget_settings (user_id, month_year, monthly_allowance, budget_locked, split_percentage)
        VALUES (%s, %s, %s, TRUE, %s)
        ON DUPLICATE KEY UPDATE monthly_allowance = %s, budget_locked = TRUE, split_percentage = %s
    """, (user_id, month_year, monthly_allowance, split_percentage, monthly_allowance, split_percentage))

    for week_key, allocated in week_allocations.items():
        cursor.execute("""
            INSERT INTO week_budgets (user_id, month_year, week_key, allocated, spent, ended)
            VALUES (%s, %s, %s, %s, 0, FALSE)
            ON DUPLICATE KEY UPDATE allocated = %s
        """, (user_id, month_year, week_key, allocated, allocated))

    if leftover > 0:
        savings_add = round(leftover, 2)
        cursor.execute("""
            INSERT INTO income_accounts (user_id, month_year, account_type, balance)
            VALUES (%s, %s, 'savings', %s)
            ON DUPLICATE KEY UPDATE balance = balance + %s
        """, (user_id, month_year, savings_add, savings_add))

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True})

# ── EXPENSES ──────────────────────────────────────────────────────────────────

@app.route('/api/expenses', methods=['GET'])
@jwt_required()
def get_expenses():
    user_id = int(get_jwt_identity())
    month_year = request.args.get('month', get_current_month())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT * FROM expenses WHERE user_id = %s AND month_year = %s ORDER BY expense_date DESC, created_at DESC
    """, (user_id, month_year))
    expenses = cursor.fetchall()
    for e in expenses:
        e['amount'] = float(e['amount'])
        if e.get('expense_date'):
            e['expense_date'] = e['expense_date'].isoformat()
        if e.get('created_at'):
            e['created_at'] = e['created_at'].isoformat()
    cursor.close()
    conn.close()
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
@jwt_required()
def add_expense():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    category = data.get('category')
    description = data.get('description', '').strip()
    amount = float(data.get('amount', 0))
    expense_date = data.get('expense_date')

    if not category or not description or amount <= 0:
        return jsonify({'error': 'Invalid expense data'}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    needs_categories = ['fixed_week1', 'week2', 'week3', 'week4']

    if category in needs_categories:
        cursor.execute("SELECT ended, allocated, spent FROM week_budgets WHERE user_id = %s AND month_year = %s AND week_key = %s",
                       (user_id, month_year, category))
        week = cursor.fetchone()
        if week and week['ended']:
            cursor.close()
            conn.close()
            return jsonify({'error': 'This week has already been ended'}), 400

        cursor.execute("""
            INSERT INTO week_budgets (user_id, month_year, week_key, allocated, spent, ended)
            VALUES (%s, %s, %s, 0, %s, FALSE)
            ON DUPLICATE KEY UPDATE spent = spent + %s
        """, (user_id, month_year, category, amount, amount))
    else:
        cursor.execute("SELECT balance FROM income_accounts WHERE user_id = %s AND month_year = %s AND account_type = %s",
                       (user_id, month_year, category))
        account = cursor.fetchone()
        if not account or float(account['balance']) < amount:
            cursor.close()
            conn.close()
            return jsonify({'error': f'Insufficient balance in {category}'}), 400

        cursor.execute("""
            UPDATE income_accounts SET balance = balance - %s, total_spent = total_spent + %s
            WHERE user_id = %s AND month_year = %s AND account_type = %s
        """, (amount, amount, user_id, month_year, category))

    cursor.execute("""
        INSERT INTO expenses (user_id, month_year, category, description, amount, expense_date)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (user_id, month_year, category, description, amount, expense_date))

    conn.commit()
    expense_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'id': expense_id}), 201

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(expense_id):
    user_id = int(get_jwt_identity())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM expenses WHERE id = %s AND user_id = %s", (expense_id, user_id))
    expense = cursor.fetchone()
    if not expense:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Expense not found'}), 404

    amount = float(expense['amount'])
    category = expense['category']
    month_year = expense['month_year']
    needs_categories = ['fixed_week1', 'week2', 'week3', 'week4']

    if category in needs_categories:
        cursor.execute("SELECT ended FROM week_budgets WHERE user_id = %s AND month_year = %s AND week_key = %s",
                       (user_id, month_year, category))
        week = cursor.fetchone()
        if week and week['ended']:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Cannot delete from ended week'}), 400
        cursor.execute("UPDATE week_budgets SET spent = GREATEST(0, spent - %s) WHERE user_id = %s AND month_year = %s AND week_key = %s",
                       (amount, user_id, month_year, category))
    else:
        cursor.execute("UPDATE income_accounts SET balance = balance + %s, total_spent = GREATEST(0, total_spent - %s) WHERE user_id = %s AND month_year = %s AND account_type = %s",
                       (amount, amount, user_id, month_year, category))

    cursor.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True})

# ── END WEEK ──────────────────────────────────────────────────────────────────

@app.route('/api/budget/week-allocation', methods=['POST'])
@jwt_required()
def update_week_allocation():
    """Update a single week's allocated amount — allowed any time the week hasn't ended."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    week_key = data.get('week_key')
    allocated = float(data.get('allocated', 0))

    if not week_key:
        return jsonify({'error': 'week_key is required'}), 400
    if allocated < 0:
        return jsonify({'error': 'Allocated amount cannot be negative'}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Block update if week is already ended
    cursor.execute(
        "SELECT ended, spent FROM week_budgets WHERE user_id = %s AND month_year = %s AND week_key = %s",
        (user_id, month_year, week_key)
    )
    row = cursor.fetchone()
    if row and row['ended']:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Cannot update an ended week'}), 400

    # Upsert the allocation
    cursor.execute("""
        INSERT INTO week_budgets (user_id, month_year, week_key, allocated, spent, ended)
        VALUES (%s, %s, %s, %s, 0, FALSE)
        ON DUPLICATE KEY UPDATE allocated = %s
    """, (user_id, month_year, week_key, allocated, allocated))

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/budget/end-week', methods=['POST'])
@jwt_required()
def end_week():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    week_key = data.get('week_key')
    split_percentage = int(data.get('split_percentage', 50))

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM week_budgets WHERE user_id = %s AND month_year = %s AND week_key = %s",
                   (user_id, month_year, week_key))
    week = cursor.fetchone()
    if not week:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Week not found'}), 404
    if week['ended']:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Week already ended'}), 400

    allocated = float(week['allocated'])
    spent = float(week['spent'])
    diff = round(allocated - spent, 2)
    savings_pct = split_percentage / 100
    personal_pct = 1 - savings_pct

    if diff > 0:
        savings_add = round(diff * savings_pct, 2)
        personal_add = round(diff * personal_pct, 2)
        for acct, add_amt in [('savings', savings_add), ('personal', personal_add)]:
            cursor.execute("""
                INSERT INTO income_accounts (user_id, month_year, account_type, balance)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE balance = balance + %s
            """, (user_id, month_year, acct, add_amt, add_amt))
    elif diff < 0:
        deficit = abs(diff)
        cursor.execute("SELECT balance FROM income_accounts WHERE user_id = %s AND month_year = %s AND account_type = 'personal'",
                       (user_id, month_year))
        personal_acct = cursor.fetchone()
        personal_balance = float(personal_acct['balance']) if personal_acct else 0

        if personal_balance >= deficit:
            cursor.execute("UPDATE income_accounts SET balance = balance - %s WHERE user_id = %s AND month_year = %s AND account_type = 'personal'",
                           (deficit, user_id, month_year))
        elif personal_balance > 0:
            remaining = round(deficit - personal_balance, 2)
            cursor.execute("UPDATE income_accounts SET balance = 0 WHERE user_id = %s AND month_year = %s AND account_type = 'personal'",
                           (user_id, month_year))
            cursor.execute("UPDATE income_accounts SET balance = GREATEST(0, balance - %s) WHERE user_id = %s AND month_year = %s AND account_type = 'savings'",
                           (remaining, user_id, month_year))
        else:
            cursor.execute("UPDATE income_accounts SET balance = GREATEST(0, balance - %s) WHERE user_id = %s AND month_year = %s AND account_type = 'savings'",
                           (deficit, user_id, month_year))

    cursor.execute("UPDATE week_budgets SET ended = TRUE WHERE user_id = %s AND month_year = %s AND week_key = %s",
                   (user_id, month_year, week_key))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'diff': diff})

# ── EXTERNAL INCOME ───────────────────────────────────────────────────────────

@app.route('/api/income/external', methods=['POST'])
@jwt_required()
def add_external_income():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    amount = float(data.get('amount', 0))
    description = data.get('description', 'External Income').strip() or 'External Income'
    split_percentage = int(data.get('split_percentage', 50))

    if amount <= 0:
        return jsonify({'error': 'Invalid amount'}), 400

    savings_pct = split_percentage / 100
    personal_pct = 1 - savings_pct
    savings_add = round(amount * savings_pct, 2)
    personal_add = round(amount * personal_pct, 2)

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    today = datetime.now().strftime('%Y-%m-%d')
    cursor.execute("""
        INSERT INTO external_income (user_id, month_year, amount, description, income_date, split_percentage)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (user_id, month_year, amount, description, today, split_percentage))

    for acct, add_amt in [('savings', savings_add), ('personal', personal_add)]:
        cursor.execute("""
            INSERT INTO income_accounts (user_id, month_year, account_type, balance, external_income_total)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE balance = balance + %s, external_income_total = external_income_total + %s
        """, (user_id, month_year, acct, add_amt, amount if acct == 'savings' else 0,
              add_amt, amount if acct == 'savings' else 0))

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True, 'savings_add': savings_add, 'personal_add': personal_add})

@app.route('/api/income/external', methods=['GET'])
@jwt_required()
def get_external_income():
    user_id = int(get_jwt_identity())
    month_year = request.args.get('month', get_current_month())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM external_income WHERE user_id = %s AND month_year = %s ORDER BY created_at DESC",
                   (user_id, month_year))
    records = cursor.fetchall()
    for r in records:
        r['amount'] = float(r['amount'])
        if r.get('income_date'):
            r['income_date'] = r['income_date'].isoformat()
        if r.get('created_at'):
            r['created_at'] = r['created_at'].isoformat()
    cursor.close()
    conn.close()
    return jsonify(records)

@app.route('/api/income/accounts', methods=['GET'])
@jwt_required()
def get_income_accounts():
    user_id = int(get_jwt_identity())
    month_year = request.args.get('month', get_current_month())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM income_accounts WHERE user_id = %s AND month_year = %s",
                   (user_id, month_year))
    accounts_raw = cursor.fetchall()
    accounts = {}
    for a in accounts_raw:
        accounts[a['account_type']] = {
            'balance': float(a['balance']),
            'total_spent': float(a['total_spent']),
            'external_income_total': float(a['external_income_total'])
        }
    for acct in ['savings', 'personal']:
        if acct not in accounts:
            accounts[acct] = {'balance': 0, 'total_spent': 0, 'external_income_total': 0}
    cursor.close()
    conn.close()
    return jsonify(accounts)

# ── RESET ─────────────────────────────────────────────────────────────────────

@app.route('/api/budget/reset-month', methods=['POST'])
@jwt_required()
def reset_month():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    month_year = data.get('month_year', get_current_month())
    new_month_year = data.get('new_month_year', get_current_month())

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    # Get balances to carry over
    cursor.execute("SELECT account_type, balance FROM income_accounts WHERE user_id = %s AND month_year = %s",
                   (user_id, month_year))
    old_accounts = {a['account_type']: float(a['balance']) for a in cursor.fetchall()}

    # Clear old month data
    cursor.execute("DELETE FROM expenses WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM week_budgets WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM income_accounts WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM external_income WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("UPDATE budget_settings SET budget_locked = FALSE WHERE user_id = %s AND month_year = %s",
                   (user_id, month_year))

    # Carry over balances
    for acct_type, balance in old_accounts.items():
        if balance > 0:
            cursor.execute("""
                INSERT INTO income_accounts (user_id, month_year, account_type, balance)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE balance = balance + %s
            """, (user_id, new_month_year, acct_type, balance, balance))

    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/budget/clear-all', methods=['DELETE'])
@jwt_required()
def clear_all_data():
    user_id = int(get_jwt_identity())
    month_year = request.args.get('month', get_current_month())

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM week_budgets WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM income_accounts WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM external_income WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    cursor.execute("DELETE FROM budget_settings WHERE user_id = %s AND month_year = %s", (user_id, month_year))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'success': True})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
else:
    import atexit
    init_db()