$baseUrl = "http://localhost:3000/api/v1"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Test-Endpoint {
    param($Name, $Script)
    Write-Host "`n--- Testing: $Name ---" -ForegroundColor Cyan
    try {
        $result = &$Script
        Write-Host "Status: SUCCESS" -ForegroundColor Green
        # Write-Host ($result | ConvertTo-Json -Depth 10)
        return $result
    } catch {
        Write-Host "Status: FAILED" -ForegroundColor Red
        Write-Host $_.Exception.Message
        return $null
    }
}

# 1. Register
$regData = @{ email = "tester_$(Get-Random)@test.com"; password = "password123" }
$regResult = Test-Endpoint "User Registration" {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json" -WebSession $session
}

# 2. Login
$loginResult = Test-Endpoint "User Login" {
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($regData | ConvertTo-Json) -ContentType "application/json" -WebSession $session
}

# 3. Create Agent
$agentResult = Test-Endpoint "Create Agent" {
    Invoke-RestMethod -Uri "$baseUrl/agents" -Method Post -Body (@{ name = "TestBot" } | ConvertTo-Json) -ContentType "application/json" -WebSession $session
}
$agentId = $agentResult.data.id

# 4. Generate API Key
$keyResult = Test-Endpoint "Generate API Key" {
    Invoke-RestMethod -Uri "$baseUrl/agents/$agentId/api-keys" -Method Post -WebSession $session
}
$apiKey = $keyResult.data.plaintext
Write-Host "API Key Generated: $apiKey" -ForegroundColor Yellow

# 5. Create Task
$taskResult = Test-Endpoint "Create Task" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body (@{ title = "Automated Test Task"; description = "This is a test task"; budget = 100 } | ConvertTo-Json) -ContentType "application/json" -WebSession $session
}
$taskId = $taskResult.data.id

# 6. List Tasks (Public)
$listResult = Test-Endpoint "List Tasks (Public)" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Get
}

# 7. Get Task Detail
$detailResult = Test-Endpoint "Get Task Detail" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId" -Method Get
}

# 8. Cancel Task
$cancelResult = Test-Endpoint "Cancel Task (State Guard)" {
    Invoke-RestMethod -Uri "$baseUrl/tasks/$taskId" -Method Patch -Body (@{ status = "CANCELED" } | ConvertTo-Json) -ContentType "application/json" -WebSession $session
}

# 9. Test Agent Auth (Header)
$agentAuthResult = Test-Endpoint "Agent Auth Header Verification" {
    Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Get -Headers @{ Authorization = "Bearer $apiKey" }
}

Write-Host "`n--- All Tests Completed ---" -ForegroundColor Magenta
