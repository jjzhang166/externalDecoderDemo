
var getMediaButton = document.querySelector('button#getMedia');
var connectButton = document.querySelector('button#connect');
var hangupButton = document.querySelector('button#hangup');
var bitrateDiv = document.querySelector('div#bitrate');
var decoderImplementationDiv = document.getElementById('decoderImplementation')

var localVideo = document.querySelector('div#localVideo video');
var remoteVideo = document.querySelector('div#remoteVideo video');
var localVideoStatsDiv = document.querySelector('div#localVideo div');
var remoteVideoStatsDiv = document.querySelector('div#remoteVideo div');
var localPeerConnection;
var remotePeerConnection;
var localStream;
var bytesPrev;
var timestampPrev;
var constraints ={
    audio: true,
    video: {
        width: { max: '1920' },
        height: { max: '1080' },
        frameRate: { max: '5' }
    }
};
var targetPresentStream = null;

function getMedia() {
    console.warn('GetUserMedia start!');
    getMediaButton.disabled = true;
    if (localStream) {
        localStream.getTracks().forEach(function(track) {
            track.stop();
        });
        var videoTracks = localStream.getVideoTracks();
        for (var i = 0; i !== videoTracks.length; ++i) {
            videoTracks[i].stop();
        }
    }
    console.warn('getDisplayMedia constraints: \n', JSON.stringify(constraints, null, '    '));

    if('getDisplayMedia' in window.navigator){
        navigator.getDisplayMedia(constraints)
            .then(gotStream)
            .catch(function(e) {
                console.error(e)
                console.warn("getUserMedia failed!");
                var message = 'getUserMedia error: ' + e.name + '\n' +
                    'PermissionDeniedError may mean invalid constraints.';
                alert(message);
                console.log(message);
                getMediaButton.disabled = false;
            });
    }else if('getDisplayMedia' in window.navigator.mediaDevices){
        navigator.mediaDevices.getDisplayMedia(constraints)
            .then(gotStream)
            .catch(function(e) {
                console.error(e);
                var message = 'getUserMedia error: ' + e.name + '\n' +
                    'PermissionDeniedError may mean invalid constraints.';
                alert(message);
                console.log(message);
                getMediaButton.disabled = false;
            });
    }else {
        var screen_constraints = {
            audio: false,
            video: {
                mozMediaSource: 'screen',
                mediaSource: 'screen',
                width: {min: '10',max: '1920'},
                height: {min: '10',max: '1080'},
                frameRate: {min: '1', max: '5'}
            }
        };
        navigator.mediaDevices.getUserMedia(screen_constraints).then(gotStream).catch(function (e) {
            console.error(e);
            var message = 'getUserMedia error: ' + e.name + '\n' + 'PermissionDeniedError may mean invalid constraints.';
            alert(message);
            console.log(message);
            getMediaButton.disabled = false;
        })

        console.warn("该浏览器不支持getDisplayMedia接口");
    }
}


function gotStream(stream) {
    connectButton.disabled = false;
    console.warn('GetUserMedia succeeded:');
    localStream = stream;
    localVideo.srcObject = stream;

    stream.oninactive = function(){
        console.warn("stream oninactive !!!!!!!!!!")
    }

    localStream.oninactive = function () {
        console.warn("localStream oninactive !!!!!!!")
    }

    // Fixed stream.oninactive is not aways trigger when system audio sharing
    localStream.getTracks().forEach(function (track) {
        track.onended = function () {
            localStream.getTracks().forEach(function (mediaTrack) {
                if(mediaTrack.readyState !== 'ended'){
                    console.warn('stop track');
                    mediaTrack.stop()
                }
            })
        }
    })
}

function createPeerConnection() {
    console.log("begin create peerConnections");
    console.log(localStream);
    connectButton.disabled = true;
    hangupButton.disabled = false;

    bytesPrev = 0;
    timestampPrev = 0;
    localPeerConnection = new RTCPeerConnection(null);
    remotePeerConnection = new RTCPeerConnection(null);
    localStream.getTracks().forEach(function(track) {
            console.log("localPeerConnection addTack!");
            localPeerConnection.addTrack(track, localStream);
        }
    );
    console.log('localPeerConnection creating offer');
    localPeerConnection.onnegotiationeeded = function() {
        console.log('Negotiation needed - localPeerConnection');
    };
    remotePeerConnection.onnegotiationeeded = function() {
        console.log('Negotiation needed - remotePeerConnection');
    };
    localPeerConnection.onicecandidate = function(e) {
        console.log('Candidate localPeerConnection');
        remotePeerConnection.addIceCandidate(e.candidate).then(onAddIceCandidateSuccess, onAddIceCandidateError);
    };
    remotePeerConnection.onicecandidate = function(e) {
        console.log('Candidate remotePeerConnection');
        localPeerConnection.addIceCandidate(e.candidate).then(onAddIceCandidateSuccess, onAddIceCandidateError);
    };
    remotePeerConnection.ontrack = function(e) {
        console.warn("localPeerConnection iceConnectionState: ", localPeerConnection.iceConnectionState)
        console.warn("remotePeerConnectioniceConnectionState: ", remotePeerConnection.iceConnectionState)
        if (remoteVideo.srcObject !== e.streams[0]) {
            console.log('remotePeerConnection got stream');
            remoteVideo.srcObject = e.streams[0];
            targetPresentStream = e.streams[0]
        }
    };
    localPeerConnection.createOffer().then(
        function(desc) {
            console.log('localPeerConnection offering');
            localPeerConnection.setLocalDescription(desc);

            desc.sdp = setMediaBitrateAndCodecPrioritys(desc.sdp);
            console.log(`Offer from pc1 ${desc.sdp}`);
            remotePeerConnection.setRemoteDescription(desc);
            remotePeerConnection.createAnswer().then(
                function(desc2) {
                    console.log('remotePeerConnection answering');
                    remotePeerConnection.setLocalDescription(desc2);

                    desc2.sdp = setMediaBitrateAndCodecPrioritys(desc2.sdp);
                    console.warn(`Answer from pc2:\n${desc2.sdp}`);
                    localPeerConnection.setRemoteDescription(desc2);
                },
                function(err) {console.log(err);}
            );
        },
        function(err) {
            console.log(err);
        }
    );
}

function onAddIceCandidateSuccess() {
    console.log('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
    console.log('Failed to add Ice Candidate: ' + error.toString());
}

function showRemoteStats(results) {
    // calculate video bitrate
    results.forEach(function(report) {
        var now = report.timestamp;
        // console.warn("report: ", report)
        var bitrate;
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            var bytes = report.bytesReceived;
            if (timestampPrev) {
                bitrate = 8 * (bytes - bytesPrev) / (now - timestampPrev);
                bitrate = Math.floor(bitrate);
            }
            bytesPrev = bytes;
            timestampPrev = now;
            if(report.decoderImplementation){
                // console.warn("decoderImplementation： ", report.decoderImplementation)
                decoderImplementationDiv.innerHTML =  '<strong>解码器:</strong> ' + report.decoderImplementation;
            }
        }
        if (bitrate) {
            bitrate += ' kbits/sec';
            bitrateDiv.innerHTML = '<strong>Bitrate:</strong> ' + bitrate;
        }
    });
}

var encoderImplementationDiv = document.getElementById('encoderImplementation')
function showLocalStats(results) {
    // senderStatsDiv.innerHTML = '<h2>Sender stats</h2>' + statsString;
    results.forEach(function(report) {
        if (report.type === 'outbound-rtp' && report.mediaType === 'video') {
            // debugger
            if(report.encoderImplementation){
                // console.warn("decoderImplementation： ", report.decoderImplementation)
                encoderImplementationDiv.innerHTML =  '<strong>编码器:</strong> ' + report.encoderImplementation;
            }
        }
    });
}
// Display statistics
setInterval(function() {
    if (localPeerConnection && remotePeerConnection) {
        remotePeerConnection.getStats(null)
            .then(showRemoteStats, function(err) {
                console.log(err);
            });
        localPeerConnection.getStats(null)
            .then(showLocalStats, function(err) {
                console.log(err);
            });
    } else {
        // console.log('Not connected yet');
    }
    // Collect some stats from the video tags.
    if (localVideo.videoWidth) {
        localVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            localVideo.videoWidth + 'x' + localVideo.videoHeight + 'px';
    }
    if (remoteVideo.videoWidth) {
        remoteVideoStatsDiv.innerHTML = '<strong>Video dimensions:</strong> ' +
            remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight + 'px';
    }
}, 1000);


var slideVideoInCodecName = 'H264'
function setMediaBitrateAndCodecPrioritys(sdp) {
    return setMediaBitrateAndCodecPriority(sdp, "video", 1024, 1024000, 1536)
}

/**
 * 设置带宽和优先编码
 * @param sdp
 * @param media
 * @param ASBitrate
 * @param TIASBitrate
 * @param startBitrate
 * @returns {string}
 */
function setMediaBitrateAndCodecPriority(sdp, media, ASBitrate, TIASBitrate, startBitrate) {
    var lines = sdp.split("\n");
    var line = -1;
    var newLinesForBitrate;
    var newLinesForStartBitrate;
    var PTnumber;
    var codecsReorder;
    var codecs = [];
    var priorityCodecs = [];  // An encoder may have multiple PT values
    var serverUsedCode = [];
    var count = 0;

    for(var i = 0; i < lines.length; i++){
        if(lines[i].indexOf("m="+media) >= 0) {
            line = i;
            line++;
            while (lines[line].indexOf("i=") >= 0 || lines[line].indexOf("c=") >= 0) {
                line++;
            }
            if (lines[line].indexOf("b=") >= 0) {
                lines[line] = "b=AS:" + ASBitrate + "\r\nb=TIAS:" + TIASBitrate;
                return lines.join("\n");
            }

            newLinesForBitrate = lines.slice(0, line);
            newLinesForBitrate.push("b=AS:" + ASBitrate + "\r\nb=TIAS:" + TIASBitrate);
            newLinesForBitrate = newLinesForBitrate.concat(lines.slice(line, lines.length));
            break;
        }
    }

    for(var j = line; j < lines.length; j++){
        if(lines[j].indexOf("a=rtpmap") >= 0) {
            line = j;
            line++;
            if (lines[j].indexOf("VP8") >= 0) {
                PTnumber = lines[j].substr(9, 3);
                line++;
                newLinesForStartBitrate = newLinesForBitrate.slice(0, line);
                newLinesForStartBitrate.push("a=fmtp:" + PTnumber + " x-google-start-bitrate=" + startBitrate);
                newLinesForBitrate = newLinesForStartBitrate.concat(
                    newLinesForBitrate.slice(line, newLinesForBitrate.length)
                );
                count++;

                // Use the slide_video_in Codec , only for chrome
                // Currently unable to get the codec type used by firefox
                if(slideVideoInCodecName !== ""){
                    slideVideoInCodecName === "VP8"?serverUsedCode.push(PTnumber):priorityCodecs.push(PTnumber);
                }
            }
            else if (lines[j].indexOf("H264") >= 0) {
                PTnumber = lines[j].substr(9, 3);
                line++;
                line = line + count;
                newLinesForStartBitrate = newLinesForBitrate.slice(0, line);
                newLinesForStartBitrate.push("a=fmtp:" + PTnumber + " x-google-start-bitrate=" + startBitrate);
                newLinesForBitrate = newLinesForStartBitrate.concat(
                    newLinesForBitrate.slice(line, newLinesForBitrate.length)
                );
                count++;

                // Use the slide_video_in Codec , only for chrome
                // Currently unable to get the codec type used by firefox
                if(slideVideoInCodecName !== "" ){
                    slideVideoInCodecName === "H264"?serverUsedCode.push(PTnumber):priorityCodecs.push(PTnumber);
                }
            }
            else {
                codecs.push(lines[j].substr(9, 3));
            }
        }
    }

    if(slideVideoInCodecName !== "" && media === "video"){
        var mLineRegex = /^m=video\s[0-9]{1,}\s\w{3,5}(\/\w{3,5})*?\s/;
        codecsReorder = serverUsedCode.concat(priorityCodecs.concat(codecs)).join(" ").replace(/\s+/g, " ");
        for(var k = 0; k < newLinesForBitrate.length; k++){
            if(newLinesForBitrate[k].indexOf("m="+media) === 0) {
                newLinesForBitrate[k] = newLinesForBitrate[k].match(mLineRegex)[0] + codecsReorder;
            }
        }
    }

    return newLinesForBitrate.join("\n");
}

/**
 * 挂断
 */
function hangup() {
    console.log('Ending call');
    localPeerConnection.close();
    remotePeerConnection.close();

    // query stats one last time.
    Promise.all([
        remotePeerConnection.getStats(null)
            .then(showRemoteStats, function(err) {
                console.log(err);
            }),
        localPeerConnection.getStats(null)
            .then(showLocalStats, function(err) {
                console.log(err);
            })
    ]).then(() => {
        localPeerConnection = null;
        remotePeerConnection = null;
    });

    localStream.getTracks().forEach(function(track) {
        track.stop();
    });
    localStream = null;

    hangupButton.disabled = true;
    getMediaButton.disabled = false;
    // window.location.reload();
}
