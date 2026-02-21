$baseUrl = "http://localhost:3000/api/v1"
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Test-Claim {
    param($Name, $TaskId, $AgentSession, $Body, $ExpectedCode = "SUCCESS")
    Write-Host "`n--- Testing Claim: $Name ---" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/tasks/$TaskId/claim" -Method Post -Body ($Body | ConvertTo-Json) -ContentType "application/json" -WebSession $AgentSession
        if ($ExpectedCode -eq "SUCCESS") {
            Write-Host "Status: SUCCESS" -ForegroundColor Green
            return $response
        } else {
            Write-Host "Status: FAILED (Expected $ExpectedCode but got 200 SUCCESS)" -ForegroundColor Red
        }
    } catch {
        $errorBody = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorBody)
        $json = $reader.ReadToEnd() | ConvertFrom-Json
        if ($json.error.code -eq $ExpectedCode) {
            Write-Host "Status: SUCCESS (Caught $ExpectedCode)" -ForegroundColor Green
        } else {
            Write-Host "Status: FAILED (Expected $ExpectedCode but got $($json.error.code))" -ForegroundColor Red
            Write-Host ($json | ConvertTo-Json -Depth 5)
        }
    }
}

# 1. Setup Data
Write-Host "Setting up test data..." -ForegroundColor Gray
$regData = @{ email = "poster_d3_$(Get-Random)@test.com"; password = "password123" }
Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession | Out-Null

$agentData = @{ name = "ClaimAgent" }
$agentRes = Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body ($agentData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
$agentId = $agentRes.data.id

$keyRes = Invoke-RestMethod -Uri "$baseUrl/agents/$agentId/api-keys" -Method Post -WebSession $userSession
$apiKey = $keyRes.data.api_key
$agentSession.Headers.Add("Authorization", "Bearer $apiKey")

$taskData = @{ title = "Day 3 Task"; description = "Claim me"; budget = 100 }
$taskRes = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body ($taskData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
$taskId = $taskRes.data.id

# 2. Test Success
Test-Claim "Successful Claim" $taskId $agentSession @{ proposed_credits = 90 }

# 3. Test Task Not Open (Already Claimed)
Test-Claim "Claim Already Claimed Task" $taskId $agentSession @{ proposed_credits = 90 } "TASK_NOT_OPEN"

# 4. Create another task for budget test
$task2Res = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body ($taskData | ConvertTo-Json) -ContentType "application/json" -WebSession $userSession
$taskId2 = $task2Res.data.id

# 5. Test Budget Constraint
Test-Claim "Claim with high budget" $taskId2 $agentSession @{ proposed_credits = 150 } "INVALID_PROPOSED_CREDITS"

# 6. Test Human cannot claim
Test-Claim "Human Claim attempt" $taskId2 $userSession @{ proposed_credits = 50 } "INVALID_API_KEY"

# 7. Test Nonexistent task
Test-Claim "Claim Nonexistent Task" 99999 $agentSession @{ proposed_credits = 50 } "TASK_NOT_FOUND"

Write-Host "`n--- Day 3 Claim Testing Completed ---" -ForegroundColor Magenta
