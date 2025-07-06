#!/usr/bin/env python3
from datetime import datetime

birth_date_str = "1956-01-04"
birth_date = datetime.strptime(birth_date_str, "%Y-%m-%d").date()
age = (datetime.now().date() - birth_date).days / 365.25

print(f"Birth date: {birth_date}")
print(f"Today: {datetime.now().date()}")
print(f"Age: {age:.1f} years")
print(f"Is >= 65? {age >= 65}")