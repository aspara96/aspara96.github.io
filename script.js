html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.app-header {
    background: #ffffff;
    border-bottom: 1px solid #ddd;
    padding: 10px;
}

.title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 6px;
}

.search-area {
    display: flex;
    gap: 6px;
}

.search-area input {
    flex: 1;
    padding: 10px;
    font-size: 16px;
    border-radius: 8px;
    border: 1px solid #ccc;
}

.search-area button {
    padding: 10px 14px;
    font-size: 16px;
    border-radius: 8px;
    border: none;
    background: #007aff;
    color: white;
}

#map {
    height: calc(100% - 140px);
}

.bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    gap: 10px;
    padding: 10px;
    background: white;
    border-top: 1px solid #ddd;
}

.bottom-bar button {
    flex: 1;
    padding: 14px;
    font-size: 16px;
    border-radius: 10px;
    border: none;
    background: #333;
    color: white;
}