$baseUrl = "http://localhost:3000/api/v1"
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Call-API {
    param($Method, $Path, $Body, $Session, $Headers = @{})
    $uri = "$baseUrl$Path"
    
    if ($Method -eq "Post" -and !$Headers.ContainsKey("Idempotency-Key")) {
        $Headers["Idempotency-Key"] = [guid]::NewGuid().ToString()
    }

    if ($null -ne $Body) { $jsonBody = $Body | ConvertTo-Json }
    try {
        if ($null -ne $Body) {
            return Invoke-RestMethod -Uri $uri -Method $Method -Body $jsonBody -ContentType "application/json" -WebSession $Session -Headers $Headers
        } else {
            return Invoke-RestMethod -Uri $uri -Method $Method -WebSession $Session -Headers $Headers
        }
    } catch { return $_ }
}

# 1. Setup
$id = Get-Random
Call-API -Method Post -Path "/auth/register" -Body @{ email = "exp_test_$id@val.com"; password = "password123" } -Session $userSession | Out-Null
$agentRes = Call-API -Method Post -Path "/agents" -Body @{ name = "Agent 1" } -Session $userSession
$agentId1 = $agentRes.data.id
$apiKey1 = (Call-API -Method Post -Path "/agents/$agentId1/api-keys" -Session $userSession).data.api_key

function Get-AgentHeaders($key) {
    return @{ "Authorization" = "Bearer $key"; "Idempotency-Key" = [guid]::NewGuid().ToString() }
}

$taskRes = Call-API -Method Post -Path "/tasks" -Body @{ title = "Expiry Test $id"; description = "Desc"; budget = 100 } -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
$taskId = $taskRes.data.id
Write-Host "Created task: $taskId"

# 2. Agent 1 Claims
Call-API -Method Post -Path "/tasks/$taskId/claim" -Body @{ proposed_credits = 100 } -Headers (Get-AgentHeaders $apiKey1) | Out-Null
Write-Host "Agent 1 claimed task"

# 3. Simulate Expiry
node simulate_expiry.mjs $taskId
Write-Host "Simulated expiry"

# 4. Agent 1 tries to deliver -> Expect 409 CLAIM_EXPIRED
$delErr = Call-API -Method Post -Path "/tasks/$taskId/deliver" -Body @{ content = "Work" } -Headers (Get-AgentHeaders $apiKey1)
if ($delErr.Exception.Response.StatusCode -eq "Conflict") {
    $stream = $delErr.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
    if ($errorBody.error.code -eq "CLAIM_EXPIRED") {
        Write-Host "Delivery rejected as expected: CLAIM_EXPIRED" -ForegroundColor Green
    } else {
        Write-Host "Delivery rejected with wrong code: $($errorBody.error.code)" -ForegroundColor Red; exit 1
    }
} else {
    Write-Host "Error: $($delErr)"
    Write-Host "Delivery should have been rejected!"; exit 1
}

# 5. Verify task appears in Browse (Lazy OPEN)
$browse = Call-API -Method Get -Path "/tasks?limit=50"
# Debug: list IDs
$ids = $browse.data.tasks | ForEach-Object { $_.id }
Write-Host "Browse Result IDs: $($ids -join ', ')"

$found = $browse.data.tasks | Where-Object { $_.id -eq $taskId }
if ($found) {
    Write-Host "Expired task visible in Browse: SUCCESS" -ForegroundColor Green
} else {
    Write-Host "Expired task NOT visible in Browse: FAILED" -ForegroundColor Red
    Write-Host "Browse data count: $($browse.data.tasks.Count)"; exit 1
}

# 6. Agent 2 Re-claims
$agentRes2 = Call-API -Method Post -Path "/agents" -Body @{ name = "Agent 2" } -Session $userSession
$agentId2 = $agentRes2.data.id
$apiKey2 = (Call-API -Method Post -Path "/agents/$agentId2/api-keys" -Session $userSession).data.api_key

$reclaimRes = Call-API -Method Post -Path "/tasks/$taskId/claim" -Body @{ proposed_credits = 100 } -Headers (Get-AgentHeaders $apiKey2)
if ($reclaimRes.status -eq "SUCCESS") {
    Write-Host "Agent 2 successfully re-claimed expired task" -ForegroundColor Green
} else {
    Write-Host "Agent 2 failed to re-claim: $($reclaimRes | ConvertTo-Json)"; exit 1
}

Write-Host "`n--- Expiration System Verified ---" -ForegroundColor Green
