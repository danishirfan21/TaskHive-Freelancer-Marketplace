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
                return $null
            }
        }
        Write-Host "Status: FAILED" -ForegroundColor Red
        return $null
    }
}

# 1. Setup
Write-Host "Setting up test data..."
$regData = @{ email = "day4_poster_$(Get-Random)@test.com"; password = "password123" }
Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession | Out-Null

$agentData = @{ name = "Day4 Agent" }
$agentRes = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body ($agentData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
$agentId = $agentRes.data.id

$keyRes = Invoke-RestMethod -Uri "$baseUrl/agents/$agentId/api-keys" -Method Post -WebSession $userSession
$apiKey = $keyRes.data.api_key
$agentSession.Headers.Add("Authorization", "Bearer $apiKey")

$taskData = @{ title = "Day 4 Task"; description = "Final test"; budget = 500 }
$taskRes = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body ($taskData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
$taskId = $taskRes.data.id

# Claim it
Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/claim" -Method Post -Body (@{ proposed_credits = 500 } | ConvertTo-Json) -ContentType "application/json" -WebSession $agentSession | Out-Null

# 2. Test Deliver
Test-Endpoint "Deliver Task" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/deliver" -Method Post -Body (@{ content = "Initial submission" } | ConvertTo-Json) -ContentType "application/json" -WebSession $agentSession
}

# 3. Test Revision Request
Test-Endpoint "Request Revision" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/request-revision" -Method Post -WebSession $userSession
}

# 4. Test Re-delivery
Test-Endpoint "Deliver Task Rev 2" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/deliver" -Method Post -Body (@{ content = "Revised submission" } | ConvertTo-Json) -ContentType "application/json" -WebSession $agentSession
}

# 5. Test Accept
$acceptRes = Test-Endpoint "Accept Task" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/accept" -Method Post -WebSession $userSession
}

# 6. Verify Reputation
$repRes = Test-Endpoint "Check Reputation" {
    Invoke-RestMethod -Uri "$baseUrl/agents/me/reputation" -Method Get -WebSession $agentSession
}
if ($repRes.data.reputation -eq 500) {
    Write-Host "Reputation Match: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "Reputation Match: FAILED (Expected 500, got $($repRes.data.reputation))" -ForegroundColor Red
}

# 7. Failure: Double Accept
Test-Endpoint "Failure: Double Accept" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId/accept" -Method Post -WebSession $userSession
} "TASK_ALREADY_ACCEPTED"

Write-Host "`n--- Day 4 Testing Completed ---" -ForegroundColor Magenta
