/** @type {RTCPeerConnection} */
let yourConn;
let localUser;
let localStream;
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

const showUsername = document.getElementById('showLocalUserName');
const callOngoing = document.getElementById('callOngoing');
const hostnameInput = document.getElementById('hostnameInput');
const startscreem = document.getElementById("startscreem");
const hostSection = document.getElementById("hostSection");
const localVideo = document.getElementById('localVideo');
const hostView = document.getElementById("hostView");

document.addEventListener("DOMContentLoaded", () => {

    hostView.style.display = "none";
    // 當 開船 按鈕被按下時
    startscreem.addEventListener("click", () => {
    // 隱藏角色選擇區，顯示 直播 區域
    hostSection.style.display = "none";
    hostView.style.display = "block";
  });
});

function hangUpClick() {
	send({
		type: 'hangup',
		name: localUser,
	});

	handelHangUp();
}

function gotMessageFromServer(message) {
	console.log('Got message', message.data);
	const data = JSON.parse(message.data);

    switch (data.type) {
		case 'login':
			handleLogin(data.success, data.allUsers, data.share);
			break;
        case 'hangup':
			handelHangUp();
			break;
        case 'users':
            refreshUserList(data.users);
            break;
        default:
			break;
	}
    serverConnection.onerror = errorHandler;
}

function getUserMediaSuccess(stream) {
	console.log('Media stream obtained successfully');
	localStream = stream;
	localVideo.srcObject = stream;
	yourConn = new RTCPeerConnection(peerConnectionConfig);

	console.log('connection state inside getusermedia', yourConn.connectionState);

	setupConnection(stream);
}

function setupConnection(stream) {
	yourConn = new RTCPeerConnection(peerConnectionConfig);

	yourConn.onicecandidate = (event) => {
		console.log('onicecandidate: ', event.candidate);
		if (event.candidate) {
			send({
				type: 'candidate',
				name: connectedUser,
				candidate: event.candidate,
			});
		}
	};
	yourConn.ontrack = (event) => {
		console.log('got remote stream');
		showRemoteUsername.innerHTML = connectedUser;
		remoteVideo.srcObject = event.streams[0];
		remoteVideo.hidden = false;
	};
	stream.getTracks().forEach((track) => {
        yourConn.addTrack(track, stream);
    });
}

function send(msg) {
	console.log('sending:\n', msg);
	serverConnection.send(JSON.stringify(msg));
}

/**
 * @param {'m'|'s'} mediaType
 */
function share(mediaType) {
	localUser = hostnameInput.value;
	showUsername.innerHTML = localUser;
	if (localUser.length > 0) {
		send({
			type: 'login',
			name: localUser,
			share: mediaType,
		});
	}
}

function handleLogin(success, allUsers, share) {
	if (success === false) {
		alert('Oops...try a different username');
		return;
	}

	refreshUserList(allUsers);

	switch (share) {
		case 'm':
			navigator.mediaDevices
				.getUserMedia({
					video: true,
					audio: true,
				})
				.then(getUserMediaSuccess)
				.catch((error) => {
					console.error('Error accessing media devices:', error);
					alert('Unable to access camera or microphone. Please check your browser permissions.');
				});
			break;
	}
}


// Define the event handler functions
function handleAnswerClick() {
	connectedUser = name;
	yourConn
		.setRemoteDescription(new RTCSessionDescription(offer))
		.then(() => {
			while (candidateQueue.length) {
				const candidate = candidateQueue.shift();
				yourConn.addIceCandidate(new RTCIceCandidate(candidate)).catch(errorHandler);
			}
		})
		.catch(errorHandler);

	// Create an answer to an offer
	yourConn
		.createAnswer()
		.then((answer) => yourConn.setLocalDescription(answer))
		.then(() => {
			send({
				type: 'answer',
				name: connectedUser,
				answer: yourConn.localDescription,
			});
		})
		.catch((error) => {
			alert('Error when creating an answer: ' + error);
		});
}


function handleLeave() {
	handelHangUp();
}

function handelHangUp() {
	connectedUser = null;
	//showRemoteUsername.innerHTML = '';

	hostSection.style.display = "block";
    hostView.style.display = "none";

	yourConn.close();

	// Reset the connection
	yourConn = new RTCPeerConnection(peerConnectionConfig);
	setupConnection(localStream);
}