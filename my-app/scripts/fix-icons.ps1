# Script to revert Md* icon replacements in files that use lucide-react

$appDir = Join-Path $PSScriptRoot "..\app"
$files = Get-ChildItem -Recurse -Filter "*.tsx" -Path $appDir

$revertMap = @{
  '<MdCalendarToday '   = '<Calendar '
  '<MdCalendarToday/'   = '<Calendar/'
  '<MdAccessTime '      = '<Clock '
  '<MdAccessTime/'      = '<Clock/'
  '<MdCheckCircle '     = '<CheckCircle '
  '<MdCheckCircle/'     = '<CheckCircle/'
  '<MdCancel '          = '<XCircle '
  '<MdCancel/'          = '<XCircle/'
  '<MdWarning '         = '<AlertCircle '
  '<MdWarning/'         = '<AlertCircle/'
  '<MdInfo '            = '<Info '
  '<MdInfo/'            = '<Info/'
  '<MdVisibility '      = '<Eye '
  '<MdVisibility/'      = '<Eye/'
  '<MdRefresh '         = '<RotateCcw '
  '<MdRefresh/'         = '<RotateCcw/'
  '<MdChevronLeft '     = '<ChevronLeft '
  '<MdChevronLeft/'     = '<ChevronLeft/'
  '<MdChevronRight '    = '<ChevronRight '
  '<MdChevronRight/'    = '<ChevronRight/'
  '<MdExpandMore '      = '<ChevronDown '
  '<MdExpandMore/'      = '<ChevronDown/'
  '<MdExpandLess '      = '<ChevronUp '
  '<MdExpandLess/'      = '<ChevronUp/'
  '<MdPeople '          = '<Users '
  '<MdPeople/'          = '<Users/'
  '<MdBusiness '        = '<Building2 '
  '<MdBusiness/'        = '<Building2/'
  '<MdLocationOn '      = '<MapPin '
  '<MdLocationOn/'      = '<MapPin/'
  '<MdLock '            = '<Lock '
  '<MdLock/'            = '<Lock/'
  '<MdLockOpen '        = '<Unlock '
  '<MdLockOpen/'        = '<Unlock/'
  '<MdArrowBack '       = '<ArrowLeft '
  '<MdArrowBack/'       = '<ArrowLeft/'
  '<MdArrowForward '    = '<ArrowRight '
  '<MdArrowForward/'    = '<ArrowRight/'
  '<MdFilterList '      = '<Filter '
  '<MdFilterList/'      = '<Filter/'
  '<MdLayers '          = '<Layers '
  '<MdLayers/'          = '<Layers/'
  '<MdZoomIn '          = '<ZoomIn '
  '<MdZoomIn/'          = '<ZoomIn/'
  '<MdZoomOut '         = '<ZoomOut '
  '<MdZoomOut/'         = '<ZoomOut/'
  '<MdFullscreen '      = '<Maximize '
  '<MdFullscreen/'      = '<Maximize/'
  '<MdFullscreenExit '  = '<Minimize '
  '<MdFullscreenExit/'  = '<Minimize/'
  '<MdClose '           = '<X '
  '<MdClose/'           = '<X/'
  '<MdPerson '          = '<User '
  '<MdPerson/'          = '<User/'
  '<MdEdit '            = '<Edit '
  '<MdEdit/'            = '<Edit/'
  '<MdDelete '          = '<Trash2 '
  '<MdDelete/'          = '<Trash2/'
  '<MdSearch '          = '<Search '
  '<MdSearch/'          = '<Search/'
  '<MdArchive '         = '<Archive '
  '<MdArchive/'         = '<Archive/'
  '<MdPersonAdd '       = '<UserPlus '
  '<MdPersonAdd/'       = '<UserPlus/'
  '<MdInsertDriveFile ' = '<FileText '
  '<MdInsertDriveFile/' = '<FileText/'
}

$count = 0
foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  if ($content -match "from 'lucide-react'") {
    $newContent = $content
    foreach ($k in $revertMap.Keys) {
      $newContent = $newContent.Replace($k, $revertMap[$k])
    }
    if ($newContent -ne $content) {
      [System.IO.File]::WriteAllText($file.FullName, $newContent)
      $count++
      Write-Host "Reverted: $($file.FullName)"
    }
  }
}
Write-Host "Total reverted: $count files"
