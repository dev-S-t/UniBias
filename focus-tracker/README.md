# Focus Tracker

Focus Tracker is a FastAPI application designed to help users stay on track with their goals by analyzing periodic screenshots. The application monitors user activity and alerts them if they stray from their set focus.
![diagram (1)](https://github.com/user-attachments/assets/de763114-8e06-492a-96af-d073055de51e)


## Project Structure

```
focus-tracker
├── app
│   ├── __init__.py
│   ├── main.py
│   ├── api
│   │   ├── __init__.py
│   │   ├── endpoints
│   │   │   ├── __init__.py
│   │   │   └── alerts.py
│   │   └── dependencies.py
│   ├── core
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── settings.py
│   ├── watcher
│   │   ├── __init__.py
│   │   ├── screenshot.py
│   │   └── monitor.py
│   ├── mule
│   │   ├── __init__.py
│   │   ├── processor.py
│   │   └── tasks.py
│   └── utils
│       ├── __init__.py
│       └── image_analysis.py
├── tests
│   ├── __init__.py
│   ├── test_api.py
│   ├── test_watcher.py
│   └── test_mule.py
├── requirements.txt
├── .env
├── .gitignore
└── README.md
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd focus-tracker
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```
     source venv/bin/activate
     ```

4. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Set up your environment variables in the `.env` file.
2. Run the FastAPI application:
   ```
   uvicorn app.main:app --reload
   ```

3. Access the API documentation at `http://127.0.0.1:8000/docs`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
