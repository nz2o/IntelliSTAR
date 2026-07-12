' The server address is no longer hardcoded here -- it's entered once via the on-screen
' keyboard below (first launch, or whenever the * Options button is pressed) and
' persisted in this Roku's own local registry, so changing servers never requires
' re-editing this file and re-sideloading.
REGISTRY_SECTION = "LocalWX"
REGISTRY_KEY = "serverUrl"

' ffmpeg's HLS pipeline (roku-stream/entrypoint.sh, pipeline.sh) self-heals on its own
' after a crash, typically within a few seconds -- a short fixed retry here is enough to
' ride out that gap rather than needing anything smarter.
RETRY_DELAY_SECONDS = 5

sub Init()
    m.video = m.top.findNode("videoPlayer")
    m.video.observeField("state", "onStateChange")

    m.promptLabel = m.top.findNode("promptLabel")
    m.keyboard = m.top.findNode("urlKeyboard")
    m.keyboard.buttons = ["Done"]
    m.keyboard.observeField("buttonSelected", "onKeyboardDone")

    m.retryTimer = CreateObject("roSGNode", "Timer")
    m.retryTimer.duration = RETRY_DELAY_SECONDS
    m.retryTimer.observeField("fire", "onRetryTimer")
    m.top.appendChild(m.retryTimer)

    reg = CreateObject("roRegistrySection", REGISTRY_SECTION)
    if reg.Exists(REGISTRY_KEY)
        m.serverBase = reg.Read(REGISTRY_KEY)
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

sub onKeyboardDone()
    if m.keyboard.buttonSelected = 0 and m.keyboard.text <> ""
        reg = CreateObject("roRegistrySection", REGISTRY_SECTION)
        reg.Write(REGISTRY_KEY, m.keyboard.text)
        reg.Flush()
        m.serverBase = m.keyboard.text
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

' Lets the remote's * (Options) button reopen the address entry screen at any time --
' e.g. after moving the server to a new address -- without needing to re-sideload.
function onKeyEvent(key as String, press as Boolean) as Boolean
    if press and key = "options" and m.keyboard.visible = false
        showKeyboard(m.serverBase)
        return true
    end if
    return false
end function
