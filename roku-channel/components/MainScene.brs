' Point this at your IntelliSTAR server's LAN address and PORT (see .env) --
' server.js serves the stream at /stream/live.m3u8 whenever the intellistar-stream
' Docker Compose profile is enabled (see docker-compose.yml, .env.example). Roku
' channels can't read that server's .env, so this is the one thing you edit and
' re-sideload if your server's address or port ever changes.
STREAM_URL = "http://192.168.1.100:3000/stream/live.m3u8"

' ffmpeg's HLS pipeline (roku-stream/entrypoint.sh) self-heals on its own after a
' crash, typically within a few seconds -- a short fixed retry here is enough to ride
' out that gap rather than needing anything smarter.
RETRY_DELAY_SECONDS = 5

sub Init()
    m.video = m.top.findNode("videoPlayer")
    m.video.observeField("state", "onStateChange")

    m.retryTimer = CreateObject("roSGNode", "Timer")
    m.retryTimer.duration = RETRY_DELAY_SECONDS
    m.retryTimer.observeField("fire", "onRetryTimer")
    m.top.appendChild(m.retryTimer)

    startStream()
end sub

sub startStream()
    content = CreateObject("roSGNode", "ContentNode")
    content.url = STREAM_URL
    content.streamFormat = "hls"
    content.live = true
    m.video.content = content
    m.video.control = "play"
end sub

' The HLS playlist is a rolling live window (old segments get deleted as new ones are
' produced -- see -hls_flags delete_segments in entrypoint.sh), so this never
' legitimately reaches "finished" the way an on-demand video would; both "finished" and
' "error" here mean the stream dropped out and should be retried from scratch.
sub onStateChange()
    state = m.video.state
    if state = "error" or state = "finished" then
        m.retryTimer.control = "start"
    end if
end sub

sub onRetryTimer()
    startStream()
end sub
