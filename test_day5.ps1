$baseUrl = "http://localhost:3000/api/v1"
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Test-Endpoint {
    param($Name, $Script, $ExpectedCode = "SUCCESS")
    Write-Host "`n--- Testing: $Name ---" -ForegroundColor Cyan
    try {
        $response = &$Script
        if ($ExpectedCode -eq "SUCCESS") {
            Write-Host "Status: SUCCESS" -ForegroundColor Green
            return $response
        } else {
            Write-Host "Status: FAILED (Expected $ExpectedCode but got 200 SUCCESS)" -ForegroundColor Red
            return $null
        }
    } catch {
        if ($ExpectedCode -ne "SUCCESS") {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $json = $reader.ReadToEnd() | ConvertFrom-Json
            if ($json.error.code -eq $ExpectedCode) {
                Write-Host "Status: SUCCESS (Caught $ExpectedCode)" -ForegroundColor Green
                return $json
            } else {
                Write-Host "Status: FAILED (Expected $ExpectedCode but got $($json.error.code))" -ForegroundColor Red
                Write-Host ($json | ConvertTo-Json -Depth 5) -ForegroundColor Yellow
                return $null
            }
        }
        Write-Host "Status: FAILED - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Setup
Write-Host "Setting up test data..."
$regData = @{ email = "day5_harden_$(Get-Random)@test.com"; password = "password123" }
Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession | Out-Null

$agentRes = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body (@{ name = "HardenAgent" } | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession -Headers @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }
$agentId = $agentRes.data.id

$keyRes = Invoke-RestMethod -Uri "$baseUrl/agents/$agentId/api-keys" -Method Post -WebSession $userSession -Headers @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }
$apiKey = $keyRes.data.api_key
$agentSession.Headers.Add("Authorization", "Bearer $apiKey")

# 2. Test Idempotency: Key Required
Test-Endpoint "Idempotency Required" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body (@{ title = "No Key Task"; description = "Test"; budget = 10 } | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
} "IDEMPOTENCY_KEY_REQUIRED"

# 3. Test Idempotency: Successful Replay
$idkey = [guid]::NewGuid().ToString()
$createRes = Test-Endpoint "Initial Create" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body (@{ title = "Idemp Task"; description = "Test"; budget = 10 } | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession -Headers @{ "Idempotency-Key" = $idkey }
}
$taskId = $createRes.data.id

$replayRes = Test-Endpoint "Replayed Create" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body (@{ title = "Idemp Task"; description = "Test"; budget = 10 } | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession -Headers @{ "Idempotency-Key" = $idkey }
}
if ($replayRes.data.id -eq $taskId) {
    Write-Host "Replay ID Match: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "Replay ID Match: FAILED" -ForegroundColor Red
}

# 4. Test Idempotency: Conflict
Test-Endpoint "Idempotency Conflict" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/claim" -Method Post -Body (@{ proposed_credits = 10 } | ConvertTo-Json) -ContentType "application/json" -WebSession $agentSession -Headers @{ "Idempotency-Key" = $idkey }
} "IDEMPOTENCY_CONFLICT"

# 5. Test Pagination Hardening
Test-Endpoint "Pagination Limit Boundary" {
    Invoke-RestMethod -Uri "$baseUrl/tasks?limit=100" -Method Get
} "VALIDATION_ERROR"

Test-Endpoint "Pagination Cursor DataType" {
    Invoke-RestMethod -Uri "$baseUrl/tasks?cursor=notanid" -Method Get
} "VALIDATION_ERROR"

# 6. Test Error Polishing (safe_next_actions)
$errorRes = Test-Endpoint "Error Polishing Check" {
    Invoke-RestMethod -Uri "$baseUrl/tasks?limit=100" -Method Get
} "VALIDATION_ERROR"

if ($errorRes.error.safe_next_actions -contains "BROWSE_TASKS") {
    Write-Host "Safe Next Actions Presence: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "Safe Next Actions Presence: FAILED" -ForegroundColor Red
}

Write-Host "`n--- Day 5 Hardening Completed ---" -ForegroundColor Magenta
