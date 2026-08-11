from app import create_app

app = create_app()

if __name__ == "__main__":
    # Local dev only. Port 5001: macOS AirPlay occupies 5000 (D11).
    app.run(host="127.0.0.1", port=5001, debug=True)
