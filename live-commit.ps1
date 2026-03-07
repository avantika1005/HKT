$remoteName = "neworigin"
$branchName = "main"
$sleepIntervalSeconds = 5

Write-Host "Started auto-commit script for real-time syncing..."

while ($true) {
    # Check if there are any changes
    $status = git status --porcelain
    if ($status) {
        Write-Host "Changes detected. Committing and pushing..."
        $date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git add .
        git commit -m "Auto-commit at $date"
        git push $remoteName $branchName
        Write-Host "Changes pushed at $date"
    }
    Start-Sleep -Seconds $sleepIntervalSeconds
}
