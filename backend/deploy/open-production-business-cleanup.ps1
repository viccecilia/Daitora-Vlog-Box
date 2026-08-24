$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Daitora Vlog Box - Controlled Cleanup"
Write-Host "Daitora Vlog Box controlled production cleanup"
Write-Host "A verified database backup already exists."
Write-Host "This will preserve accounts and move referenced media into quarantine."
Write-Host "Enter the VPS sudo password only when SSH requests it. The password will not be displayed."
Read-Host "Press Enter to continue"

ssh -tt -i "$env:USERPROFILE\.ssh\tourflow_sakura_vps_ed25519" ubuntu@133.167.79.170 "bash -lc 'bash /tmp/production-business-cleanup.sh'"
$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "Remote command exit code: $exitCode"
Read-Host "Press Enter to close this window"
