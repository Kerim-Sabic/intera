param([ValidateSet("Database","Whop","Soniox")][string]$Service="Database")
# Owner-operated masked entry. Never logs or accepts a secret as a command argument.
Add-Type -AssemblyName System.Windows.Forms
$taskEnvPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../server/.env.staging'))
if (-not (Test-Path -LiteralPath $taskEnvPath)) { throw 'Prepare the protected staging environment first.' }
$taskForm = New-Object Windows.Forms.Form
$taskForm.Text = 'Intera — private staging setup'
$taskForm.Size = New-Object Drawing.Size(490,220)
$taskForm.StartPosition = 'CenterScreen'
$taskForm.FormBorderStyle = 'FixedDialog'
$taskForm.MaximizeBox = $false
$taskLabel = New-Object Windows.Forms.Label
$taskLabel.Text = if($Service -eq 'Database') {'Enter your NEW Supabase database password after resetting it. Save it privately; do not paste it in chat.'} else {'Paste the '+$Service+' SERVER API key here. It stays in the protected local file. Never paste it in chat.'}
$taskLabel.Location = New-Object Drawing.Point(20,20)
$taskLabel.Size = New-Object Drawing.Size(440,55)
$taskInput = New-Object Windows.Forms.TextBox
$taskInput.Location = New-Object Drawing.Point(20,85)
$taskInput.Size = New-Object Drawing.Size(440,25)
$taskInput.UseSystemPasswordChar = $true
$taskSave = New-Object Windows.Forms.Button
$taskSave.Text = 'Save privately'
$taskSave.Location = New-Object Drawing.Point(320,130)
$taskSave.Size = New-Object Drawing.Size(140,30)
$taskSave.Add_Click({
  if ($taskInput.Text.Length -lt 8) { return }
  try {
    $taskConfig = [IO.File]::ReadAllText($taskEnvPath)
    if($Service -eq 'Database'){
    $taskMatch = [regex]::Match($taskConfig,'(?m)^DATABASE_URL=(.+)$')
    if (-not $taskMatch.Success) { throw 'Missing DATABASE_URL' }
    $taskUri = New-Object UriBuilder($taskMatch.Groups[1].Value.Trim())
    $taskUri.Password = [Uri]::EscapeDataString($taskInput.Text)
    $taskUpdated = $taskConfig.Remove($taskMatch.Index,$taskMatch.Length).Insert($taskMatch.Index,'DATABASE_URL='+$taskUri.Uri.AbsoluteUri)
    } else {
      $taskVariable = if($Service -eq 'Whop') {'WHOP_API_KEY'} else {'SONIOX_API_KEY'}
      $taskMatch = [regex]::Match($taskConfig,'(?m)^'+$taskVariable+'=.*$')
      if(-not $taskMatch.Success){throw 'Missing secret field'}
      $taskUpdated=$taskConfig.Remove($taskMatch.Index,$taskMatch.Length).Insert($taskMatch.Index,$taskVariable+'='+$taskInput.Text.Trim())
    }
    [IO.File]::WriteAllText($taskEnvPath,$taskUpdated,(New-Object Text.UTF8Encoding($false)))
    $taskInput.Clear()
    $taskConfig = $null; $taskUpdated = $null; $taskUri = $null
    $taskForm.DialogResult = [Windows.Forms.DialogResult]::OK
    $taskForm.Close()
  } catch { [Windows.Forms.MessageBox]::Show('Could not save the protected file. No password was logged.','Intera') | Out-Null }
})
$taskForm.Controls.AddRange(@($taskLabel,$taskInput,$taskSave))
$taskForm.AcceptButton = $taskSave
$null = $taskForm.ShowDialog()
$taskForm.Dispose()
