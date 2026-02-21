$baseUrl = "http://localhost:3000/api/v1"
$user1 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$user2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Test-Failure {
    param($Name, $ExpectedCode, $Script)
    Write-Host "`n--- Failure Case: $Name ---" -ForegroundColor Cyan
    try {
        $response = &$Script
        Write-Host "Status: FAILED (Expected error but got success)" -ForegroundColor Red
    } catch {
        $errorResponse = $_.Exception.Response
        $stream = $errorResponse.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        
        if ($body.error.code -eq $ExpectedCode) {
            Write-Host "Status: SUCCESS (Caught $ExpectedCode as expected)" -ForegroundColor Green
        } else {
            Write-Host "Status: FAILED (Expected $ExpectedCode but got $($body.error.code))" -ForegroundColor Red
            Write-Host "Body: $($body | ConvertTo-Json -Depth 1)"
        }
    }
}

# Setup: Create two users
$u1Data = @{ email = "u1_$(Get-Random)@test.com"; password = "password123" }
$u2Data = @{ email = "u2_$(Get-Random)@test.com"; password = "password123" }

Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($u1Data | ConvertTo-Json) -ContentType "application/json" -WebSession $user1 | Out-Null
$u1Agent = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body (@{ name = "U1 Agent" } | ConvertTo-Json) -ContentType "application/json" -WebSession $user1
$u1AgentId = $u1Agent.data.id

Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($u2Data | ConvertTo-Json) -ContentType "application/json" -WebSession $user2 | Out-Null

# 1. Test Ownership Guard (User 2 tries to generate key for User 1's agent)
Test-Failure "Ownership Guard (Untrusted key gen)" "AGENT_NOT_OWNER" {
    Invoke-RestMethod -Uri "$baseUrl/agents/$u1AgentId/api-keys" -Method Post -WebSession $user2
}

# 2. Test Validation: Limit too large
Test-Failure "Validation: Limit > 50" "VALIDATION_ERROR" {
    Invoke-RestMethod -Uri "$baseUrl/tasks?limit=100" -Method Get
}

# 3. Test Validation: Invalid data type
Test-Failure "Validation: Non-integer limit" "VALIDATION_ERROR" {
    Invoke-RestMethod -Uri "$baseUrl/tasks?limit=abc" -Method Get
}

# 4. Test Auth: Invalid API Key
Test-Failure "Auth: Invalid Bearer Token" "INVALID_API_KEY" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Get -Headers @{ Authorization = "Bearer th_invalid_secret_key_12345" }
}

# 5. Test Auth: Malformed Header
Test-Failure "Auth: Malformed Header" "INVALID_API_KEY" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Get -Headers @{ Authorization = "Basic dGVzdDp0ZXN0" }
}

# 6. Test Data Shape Minimalist Check
Write-Host "`n--- Checking Data Shape Equality ---" -ForegroundColor Cyan
$tasks = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Get
$firstTask = $tasks.data.tasks[0]
$keys = $firstTask.psobject.Properties.Name
Write-Host "Fields in task object: $($keys -join ', ')" -ForegroundColor Yellow

$allowed = @("id", "title", "description", "budget", "createdAt")
foreach ($key in $keys) {
    if ($allowed -notcontains $key) {
        Write-Host "Status: FAILED (Unexpected field found: $key)" -ForegroundColor Red
        return
    }
}
Write-Host "Status: SUCCESS (Only allowed fields present)" -ForegroundColor Green

Write-Host "`n--- Day 2 Failure & Edge Case Testing Completed ---" -ForegroundColor Magenta
