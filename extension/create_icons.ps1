$base64_16 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADElEQVR42mNk+P+fkYGBgZGBgQEABvQD/dMhfJYAAAAASUVORK5CYII=="
$base64_48 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAFUlEQVR42mNk+P+fkYGBgZGBgQEABvQD/dMhfJYAAAAASUVORK5CYII="
$base64_128 = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADTAcB0AAAAFUlEQVR42mNk+P+fkYGBgZGBgQEABvQD/dMhfJYAAAAASUVORK5CYII="

[System.Convert]::FromBase64String($base64_16) | Set-Content -Path "icons/icon-16.png" -AsByteStream
[System.Convert]::FromBase64String($base64_48) | Set-Content -Path "icons/icon-48.png" -AsByteStream
[System.Convert]::FromBase64String($base64_128) | Set-Content -Path "icons/icon-128.png" -AsByteStream
