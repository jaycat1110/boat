/** @type {RTCPeerConnection} */
let yourConn;
let localUser;
let localStream;
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

const peerConnectionConfig = {
	iceServers: [{ urls: 'stun:stun.stunprotocol.org:3478' }, { urls: 'stun:stun.l.google.com:19302' }],
};

serverConnection.onmessage = gotMessageFromServer;

const showUsername = document.getElementById('showLocalUserName');
const callOngoing = document.getElementById('callOngoing');
const hostnameInput = document.getElementById('hostnameInput');
const showAllUsers = document.getElementById('allUsers');
const startscreem = document.getElementById("startscreem");
const hostSection = document.getElementById("hostSection");
const localVideo = document.getElementById('localVideo');
const hostView = document.getElementById("hostView");
const turnOffVideoBtn = document.getElementById('turnOffVideoBtn');
const turnOnVideoBtn = document.getElementById('turnOnVideoBtn');
const chatWindow = document.getElementById("chatWindow");
const chatMessage = document.getElementById("chatMessage");
const sendButton = document.getElementById("sendButton");


document.addEventListener("DOMContentLoaded", () => {

    hostView.style.display = "none";
    // 當 開船 按鈕被按下時
    startscreem.addEventListener("click", () => {
    // 隱藏角色選擇區，顯示 直播 區域
    hostSection.style.display = "none";
    hostView.style.display = "block";
	showUsername.innerHTML = hostnameInput.value;
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
		case 'candidate':
			handleCandidate(data.candidate);
			break;
		case 'leave':
			handleLeave();
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

function errorHandler(error) {
	console.error(error);
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
	if (localUser.length > 0) {
		send({//按下share才確認名稱(需調整)
			type: 'login',
			name: localUser,
			share: mediaType,
		});
		if (mediaType === 'm') {
            navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            }).then(getUserMediaSuccess)
            .catch((error) => {
				console.error('Error accessing media devices:', error);
				alert('Unable to access camera or microphone. Please check your browser permissions.');
			});
        } 
		else {
            console.error('Invalid mediaType');
        }
    } 
	else {
        alert('Username cannot be blank!');
	}
	
}

function handleLogin(success, allUsers, share) {
	if (success === false) {
		alert('Oops...try a different username');
		return;
	}

	refreshUserList(allUsers);

	
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

turnOffVideoBtn.addEventListener('click', () => {
    turnOffVideo();
    turnOffVideoBtn.style.display = 'none';
    turnOnVideoBtn.style.display = 'inline';
});

turnOnVideoBtn.addEventListener('click', () => {
    turnOnVideo();
    turnOffVideoBtn.style.display = 'inline';
    turnOnVideoBtn.style.display = 'none';
});

function turnOffVideo() {
    if (localStream) {
        // 停止所有視訊軌道
        localStream.getVideoTracks().forEach((track) => {
            track.stop();
        });

        // 清除並隱藏本地視訊
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
    } else {
        console.warn('No local stream found to turn off video.');
    }
}

function turnOnVideo() {
    navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
            localStream = stream;

            // 顯示本地視訊畫面
            localVideo.srcObject = stream;
            localVideo.style.display = 'block';

            // 添加視訊軌道到 RTCPeerConnection
            stream.getVideoTracks().forEach((track) => {
                yourConn.addTrack(track, stream);
            });
        })
        .catch((error) => {
            console.error('Error restarting video:', error);
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

/**
 * @param {string[]} users
 */
function refreshUserList(users) {
	const allAvailableUsers = users.join(', ');
	console.log('All available users', allAvailableUsers);
	showAllUsers.innerHTML = 'Available users: ' + allAvailableUsers;
}

// 送出訊息按鈕事件
sendButton.addEventListener("click", () => {
    const message = chatMessage.value.trim();
    if (message !== "") {
        addMessageToChat("你", message);
        chatMessage.value = ""; // 清空輸入框
    }
});

// 新增訊息到聊天室
function addMessageToChat(user, message) {
    const messageElement = document.createElement("div");
    messageElement.textContent = `${user}: ${message}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; // 自動捲動到底部
}
