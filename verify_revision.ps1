$baseUrl = "http://localhost:3000/api/v1"
$userSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Call-API {
    param($Method, $Path, $Body, $Session, $Headers = @{})
    $uri = "$baseUrl$Path"
    Write-Host ">> $Method $Path" -ForegroundColor Gray
    try {
        if ($null -ne $Body) {
            $jsonBody = $Body | ConvertTo-Json
            $res = Invoke-RestMethod -Uri $uri -Method $Method -Body $jsonBody -ContentType "application/json" -WebSession $Session -Headers $Headers
        } else {
            $res = Invoke-RestMethod -Uri $uri -Method $Method -WebSession $Session -Headers $Headers
        }
        return $res
    } catch {
        Write-Host "!! API Error: $_" -ForegroundColor Red
        if ($null -ne $_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "!! Error Body: $errorBody" -ForegroundColor Red
        }
        return $null
    }
}

# 1. Register
$id = Get-Random
$reg = Call-API -Method Post -Path "/auth/register" -Body @{ email = "test_$id@val.com"; password = "password123" } -Session $userSession
if (!$reg) { exit 1 }
Write-Host "Registered user: $($reg.data.id)"

# 2. Setup Agent & Task
$agent = Call-API -Method Post -Path "/agents" -Body @{ name = "Test Agent $id" } -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$agent) { exit 1 }
$agentId = $agent.data.id

$key = Call-API -Method Post -Path "/agents/$agentId/api-keys" -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$key) { exit 1 }
$apiKey = $key.data.api_key

$agentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$agentSession.Headers.Add("Authorization", "Bearer $apiKey")

# 3. Create Task
$task = Call-API -Method Post -Path "/tasks" -Body @{ title = "Rev Test $id"; description = "Desc"; budget = 100 } -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$task) { exit 1 }
$taskId = $task.data.id
Write-Host "Created task: $taskId"

# 4. Claim
$claim = Call-API -Method Post -Path "/tasks/$taskId/claim" -Body @{ proposed_credits = 100 } -Session $agentSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$claim) { exit 1 }
Write-Host "Claimed task"

# 5. Deliver
$del = Call-API -Method Post -Path "/tasks/$taskId/deliver" -Body @{ content = "Initial work" } -Session $agentSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$del) { exit 1 }
Write-Host "Delivered task"

# 6. Request Revision (The Feature we are testing)
$rev = Call-API -Method Post -Path "/tasks/$taskId/request-revision" -Body @{ feedback = "Please add more detail" } -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$rev) { exit 1 }
Write-Host "Revision requested. Status: $($rev.data.status)"

# 7. Re-deliver
$del2 = Call-API -Method Post -Path "/tasks/$taskId/deliver" -Body @{ content = "Revised work with more detail" } -Session $agentSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$del2) { exit 1 }
Write-Host "Re-delivered task"

# 8. Accept
$acc = Call-API -Method Post -Path "/tasks/$taskId/accept" -Session $userSession -Headers @{"Idempotency-Key" = [guid]::NewGuid().ToString()}
if (!$acc) { exit 1 }
Write-Host "Accepted task"

Write-Host "`n--- Verification Successful ---" -ForegroundColor Green
