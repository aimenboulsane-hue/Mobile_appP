# SmartPark

Mobile app for managing a parking lot, made for my Master 2 project.

Clients can see free spots, book a spot and pay (fake payment), or take a subscription.
The admin manages the parking from the same app. I also trained a machine learning model that
predicts how full the parking will be in the next days, and the app uses it to suggest prices:
more expensive when it's going to be full, a promotion when it's going to be empty.

The app is in French and prices are in DA.



## Features

Client:
- see free spots and the price now, or hour by hour for any day
- book a slot (30 min steps) and pay with a fake card
- subscriptions (monthly, 3 months, yearly), bookings are free while it's active
- history of bookings and payments, cancel a future booking (refunded)
- current promotions

Admin:
- dashboard with revenue, occupancy and charts (7 / 30 / 90 days)
- AI page: predicted occupancy and suggested price for each hour of the next 7 days, the admin
  chooses to apply it or ignore it
- change the base / min / max price
- manage spots, clients, bookings and subscriptions

## How to run it

You need Python 3.11 or 3.12, Node.js 20+, and the Expo Go app on your phone. The phone and the
PC have to be on the same Wi-Fi.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # on Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt

python ml/train.py   # trains the model
python seed.py       # creates the database with demo data
python app.py        # starts the API on port 5000
```

To check it works, open http://localhost:5000/api/health

Run `train.py` before `seed.py`. You can run `seed.py` again anytime to reset the demo data.

### Mobile app

```bash
cd mobile
copy .env.example .env        # on Mac/Linux: cp .env.example .env
npm install
npx expo start
```

Then scan the QR code with Expo Go (Android) or the camera (iPhone). Press `w` to open it in the
browser.

### If the app can't reach the server

Leave `EXPO_PUBLIC_API_URL` empty in `mobile/.env`. The app will use the IP of the PC running
Expo. If that doesn't work you can set it yourself:



Restart `npx expo start` after changing `.env`.

Other things that helped me:
- open `http://<your-pc-ip>:5000/api/health` in the phone's browser to test the connection
- on Windows, allow Python in the firewall (private networks)
- if your PC has a VPN or VirtualBox, Expo can pick the wrong IP. Start it like this:
  `$env:REACT_NATIVE_PACKAGER_HOSTNAME="<your-pc-ip>"; npx expo start`

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@smartpark.dz | Admin123! |
| Client | client@smartpark.dz | Client123! |

The seed also adds 20 other clients (same password), 50 spots in 3 zones, 3 subscription plans,
about 3 months of bookings and payments, and a few promotions. There's no way to register as admin
from the app.

### PostgreSQL

Just set `DATABASE_URL` before running `seed.py` and `app.py`:

```bash
set DATABASE_URL=postgresql://user:password@localhost:5432/smartpark
```

## The ML part

I used the Parking Birmingham dataset from UCI (around 35 000 rows, 30 car parks, Oct to Dec
2016). Each row is the number of cars in a car park at a given time, so the target is
occupancy / capacity.

Features: hour, half hour, day of the week, weekend or not, month, and the car park.

I split the data by date (first 80% for training, last 20% for testing) so the model is always
tested on dates it hasn't seen. I compared two models:

| Model | MAE | RMSE |
| --- | --- | --- |
| Random Forest | 0.0610 | 0.0998 |
| XGBoost | 0.0604 | 0.0969 |

XGBoost was a bit better so that's the one saved. An MAE of 0.06 means it's off by about 6% on
average.

Since my parking doesn't have real history, it uses the profile of one of the Birmingham car parks
(the one that has both quiet and busy hours). If the model file is missing, the API still works
and uses the average of past bookings instead.

The opening hours are 8h to 17h because the dataset only has data between those hours.

### Pricing rule

| Predicted occupancy | Suggested price |
| --- | --- |
| 85% or more | base price × occupancy / 0.75 (max = max price) |
| 35% or less | -20% (min = min price) |
| between | base price |

Example with base 100 DA: 90% predicted gives 120 DA, 25% predicted gives 80 DA.
Nothing changes until the admin clicks "Appliquer". The thresholds are in `backend/config.py`.

## Database tables

- `users`: clients and admins (passwords are hashed)
- `spots`: parking spots and their status
- `reservations`: bookings, the price is saved in the booking so it doesn't change later
- `payments`: fake payments, only the last 4 digits of the card are saved
- `plans` and `subscriptions`
- `pricing_settings`: base, min and max price
- `slot_prices`: the AI prices the admin applied or ignored

## Some rules I handled

- bookings are in 30 min steps, in the future and during opening hours
- two people can't get the same spot at the same time (the check and the insert are in the same
  transaction, I wrote a test that sends several requests at the same time for the last spot)
- the server calculates the price, it ignores any price sent by the app
- booking and payment are saved together
- cancelling a future booking refunds it
- one active subscription per client
- dates are saved in UTC, the parking is UTC+1

## Tests

```bash
cd backend
pytest               # 54 tests
python e2e_check.py  # full scenario on the running API (start app.py first)

cd mobile
npx tsc --noEmit
npm run lint
```

## Project structure

```
backend/
  app.py, config.py, models.py
  routes/      auth, client, admin, ai
  services/    booking rules and pricing
  ml/          training, prediction, dataset
  tests/
  seed.py
mobile/src/
  app/         screens (login, client tabs, admin tabs)
  components/  buttons, inputs, cards...
  features/    profile and admin pages
  lib/         api calls, login, helpers
```

## Dataset

Parking Birmingham, UCI Machine Learning Repository (Stolfi, Alba and Yao, 2017), CC BY 4.0.
