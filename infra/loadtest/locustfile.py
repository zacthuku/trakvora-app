"""
Trakvora API load test — covers the highest-traffic endpoints.

Usage:
  pip install locust
  locust -f infra/loadtest/locustfile.py --host http://localhost:8000

Set env vars to override credentials:
  LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD
"""

import os
import random
from locust import HttpUser, between, task


EMAIL = os.getenv("LOAD_TEST_EMAIL", "loadtest@trakvora.com")
PASSWORD = os.getenv("LOAD_TEST_PASSWORD", "TestPassword123!")


class UnauthenticatedUser(HttpUser):
    """Simulates anonymous visitors — landing page / health checks."""

    wait_time = between(1, 3)
    weight = 2

    @task(5)
    def health_check(self):
        self.client.get("/health", name="/health")

    @task(1)
    def demo_request(self):
        self.client.post(
            "/demo/request",
            json={
                "name": "Load Test User",
                "email": f"demo{random.randint(1, 9999)}@test.com",
                "company": "Test Logistics Ltd",
                "message": "Load test demo request",
            },
            name="/demo/request",
        )


class AuthenticatedShipper(HttpUser):
    """Simulates a logged-in shipper browsing loads and placing bids."""

    wait_time = between(2, 5)
    weight = 5

    def on_start(self):
        resp = self.client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            name="/auth/login",
        )
        if resp.status_code == 200:
            token = resp.json().get("access_token", "")
            self.client.headers.update({"Authorization": f"Bearer {token}"})
        else:
            self.environment.runner.quit()

    @task(10)
    def list_loads(self):
        self.client.get("/loads/?page=1&limit=20", name="/loads/ (list)")

    @task(5)
    def search_loads(self):
        self.client.get(
            "/loads/?origin=Nairobi&destination=Mombasa",
            name="/loads/ (search)",
        )

    @task(3)
    def get_wallet(self):
        self.client.get("/payments/wallet", name="/payments/wallet")

    @task(3)
    def list_transactions(self):
        self.client.get("/payments/transactions", name="/payments/transactions")

    @task(2)
    def list_shipments(self):
        self.client.get("/shipments/", name="/shipments/")

    @task(2)
    def list_notifications(self):
        self.client.get("/notifications/", name="/notifications/")

    @task(1)
    def get_profile(self):
        self.client.get("/users/me", name="/users/me")


class AuthenticatedOwner(HttpUser):
    """Simulates a fleet owner managing trucks and bids."""

    wait_time = between(2, 6)
    weight = 3

    def on_start(self):
        resp = self.client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            name="/auth/login",
        )
        if resp.status_code == 200:
            token = resp.json().get("access_token", "")
            self.client.headers.update({"Authorization": f"Bearer {token}"})

    @task(8)
    def list_trucks(self):
        self.client.get("/trucks/", name="/trucks/")

    @task(5)
    def list_loads(self):
        self.client.get("/loads/?page=1&limit=20", name="/loads/ (owner browse)")

    @task(4)
    def list_bids(self):
        self.client.get("/bids/", name="/bids/")

    @task(3)
    def list_drivers(self):
        self.client.get("/drivers/", name="/drivers/")

    @task(2)
    def get_stats(self):
        self.client.get("/stats/overview", name="/stats/overview")
