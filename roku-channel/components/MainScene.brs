sub Init()
    ' The server address is not hardcoded here -- it's entered once via the on-screen
    ' keyboard below (first launch, or whenever the * Options button is pressed) and
    ' persisted in this Roku's own local registry, so changing servers never requires
    ' re-editing this file and re-sideloading.
    m.registrySection = "LocalWX"
    m.registryKey = "serverUrl"

    ' ffmpeg's HLS pipeline (roku-stream/entrypoint.sh, pipeline.sh) self-heals on its
    ' own after a crash, typically within a few seconds -- a short fixed retry here is
    ' enough to ride out that gap rather than needing anything smarter.
    m.retryDelaySeconds = 5

    m.video = m.top.findNode("videoPlayer")
    m.video.observeField("state", "onStateChange")

    m.promptLabel = m.top.findNode("promptLabel")
    m.keyboard = m.top.findNode("urlKeyboard")

    m.retryTimer = CreateObject("roSGNode", "Timer")
    m.retryTimer.duration = m.retryDelaySeconds
    m.retryTimer.observeField("fire", "onRetryTimer")
    m.top.appendChild(m.retryTimer)

    reg = CreateObject("roRegistrySection", m.registrySection)
    if reg.Exists(m.registryKey)
        m.serverBase = reg.Read(m.registryKey)
        startStream()
    else
        showKeyboard("")
    end if
end sub

sub showKeyboard(prefill as String)
    m.video.control = "stop"
    m.keyboard.text = prefill
    m.keyboard.visible = true
    m.promptLabel.visible = true
    m.keyboard.setFocus(true)
end sub

sub saveAndStart()
    text = m.keyboard.text
    if text <> ""
        reg = CreateObject("roRegistrySection", m.registrySection)
        reg.Write(m.registryKey, text)
        reg.Flush()
        m.serverBase = text
        m.keyboard.visible = false
        m.promptLabel.visible = false
        startStream()
    end if
end sub

' Accepts either a bare server address ("https://your-domain.com") or the full stream
' URL someone might paste in directly -- either way this normalizes to the real
' /stream/live.m3u8 path server.js actually serves (see ../../server.js).
function resolveStreamUrl(input as String) as String
    trimmed = input
    if Right(trimmed, 1) = "/"
        trimmed = Left(trimmed, Len(trimmed) - 1)
    end if
    if LCase(Right(trimmed, 5)) = ".m3u8"
        return trimmed
    else
        return trimmed + "/stream/live.m3u8"
    end if
end function

sub startStream()
    content = CreateObject("roSGNode", "ContentNode")
    content.url = resolveStreamUrl(m.serverBase)
    content.streamFormat = "hls"
    content.live = true
    m.video.content = content
    m.video.control = "play"
    m.video.visible = true
    m.video.setFocus(true)
end sub

' The HLS playlist is a rolling live window (old segments get deleted as new ones are
' produced -- see -hls_flags delete_segments in roku-stream/pipeline.sh), so this never
' legitimately reaches "finished" the way an on-demand video would; both "finished" and
' "error" here mean the stream dropped out and should be retried from scratch.
sub onStateChange()
    state = m.video.state
    if state = "error" or state = "finished"
        m.retryTimer.control = "start"
    end if
end sub

sub onRetryTimer()
    startStream()
end sub

' The stock Keyboard component has no visible "submit" button of its own -- typing uses
' the D-pad/OK to pick letters off the on-screen grid as normal, and Play/Pause (not
' used by the grid for anything) is repurposed here as "I'm done, save this and start
' the stream." * (Options) is separately repurposed as "reopen the address screen" --
' from playback to edit the saved address, e.g. after moving the server to a new
' domain/IP, without needing to re-sideload.
function onKeyEvent(key as String, press as Boolean) as Boolean
    if press and key = "play" and m.keyboard.visible
        saveAndStart()
        return true
    else if press and key = "options" and m.keyboard.visible = false
        showKeyboard(m.serverBase)
        return true
    end if
    return false
end function
