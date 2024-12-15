/** @type {RTCPeerConnection} */
let yourConn;
let candidateQueue = [];

let localUser;
let localStream;
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

const peerConnectionConfig = {
	iceServers: [{ urls: 'stun:stun.stunprotocol.org:3478'}, { urls: 'stun:stun.l.google.com:19302' }],
};

serverConnection.onopen = () => {
	console.log('Connected to the signaling server');
};

serverConnection.onmessage = gotMessageFromServer;

const showUsername = document.getElementById('showLocalUserName');
const callOngoing = document.getElementById('callOngoing');
const hostnameInput = document.getElementById('hostnameInput');
const startscreem = document.getElementById("startscreem");
const hostSection = document.getElementById("hostSection");
const localVideo = document.getElementById('localVideo');
const hostView = document.getElementById("hostView");
const turnOffVideoBtn = document.getElementById('turnOffVideoBtn');
const turnOnVideoBtn = document.getElementById('turnOnVideoBtn');
const chatWindow = document.getElementById("chatWindow");
const chatMessage = document.getElementById("chatMessage");
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const sendButton = document.getElementById("sendButton");


document.addEventListener("DOMContentLoaded", () => {

    hostView.style.display = "none";
    // 當 開船 按鈕被按下時
    /* startscreem.addEventListener("click", () => {
    // 隱藏角色選擇區，顯示 直播 區域
    hostSection.style.display = "none";
    hostView.style.display = "block";
	showUsername.innerHTML = hostnameInput.value;
  }); */
});

// 點擊 Emoji 按鈕時，顯示或隱藏選擇器
emojiButton.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
});

// 點擊 Emoji 時，將其插入輸入框
emojiPicker.addEventListener('click', (event) => {
    if (event.target.classList.contains('emoji')) {
        chatMessage.value += event.target.textContent;
        emojiPicker.classList.add('hidden'); // 選擇後隱藏選擇器
    }
});

// 點擊其他地方隱藏 Emoji 選擇器
document.addEventListener('click', (event) => {
    if (!emojiPicker.contains(event.target) && event.target !== emojiButton) {
        emojiPicker.classList.add('hidden');
    }
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
			handleLogin(data.success/*, data.allhosts, data.share*/);
			break;
		case 'offer':
			handleOffer(data.offer, data.name);
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
	case 'chat':  // 新增處理聊天訊息的情境
		addMessageToChat(data.name, data.message);
		break;
	default:
		console.log('Unknown message type:', data);
		break;
        /*default:
			console.log(message);
			break;*/
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
	/* yourConn.ontrack = (event) => {
		console.log('got remote stream');
		showRemoteUsername.innerHTML = connectedUser;
		remoteVideo.srcObject = event.streams[0];
		remoteVideo.hidden = false;
	}; */
	yourConn.onicecandidateerror = (event) => {
		console.error('ICE Candidate Error:', event);
	};
	/* stream.getTracks().forEach((track) => {
        yourConn.addTrack(track, stream);
    }); */
	yourConn.addStream(stream);
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
	if (mediaType === 'm') {
		navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		}).then(getUserMediaSuccess)
		.catch((error) => {
			console.error('Error accessing media devices:', error);
			alert('Unable to access camera or microphone. Please check your browser permissions.');
		});
		send({
			type: 'share',
			name: localUser,
		});
	} 
	else {
		console.error('Invalid mediaType');
	}
}

function Login() {
	localUser = hostnameInput.value;
	if (localUser.length > 0) {
		send({
			type: 'hostlogin',
			name: localUser,
		});
	} 
	else {
        alert('Username cannot be blank!');
	}
}

function handleLogin(success/*, allhosts , share */) {
	if (success === false) {
		alert('Oops...try a different username');
		return;
	}
	else{
		
		hostSection.style.display = "none";
		hostView.style.display = "block";
		showUsername.innerHTML = hostnameInput.value;
		
	}

}


// Define the event handler functions
function handleOffer(offer, name) {
	console.log('Received offer:', offer);
    console.log('Connected user:', name);
    console.log('YourConn status:', yourConn);

	connectedUser = name;
	// 設置遠端描述
		yourConn
			.setRemoteDescription(new RTCSessionDescription(offer))
			.then(() => {
				console.log('Processing candidate queue:', candidateQueue);
				// 處理 ICE 候選者
				while (candidateQueue.length) {
					const candidate = candidateQueue.shift();
					console.log('Adding ICE candidate:', candidate);
					yourConn.addIceCandidate(new RTCIceCandidate(candidate)).catch(errorHandler);
				}
			})
			.catch(errorHandler);

		// Create an answer to an offer
		yourConn
			.createAnswer()
			.then((answer) => yourConn.setLocalDescription(answer))
			.then(() => {
				console.log('Local description set successfully.');
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
            /* stream.getVideoTracks().forEach((track) => {
                yourConn.addTrack(track, stream);
            }); */
			yourConn.addStream(stream);

        })
        .catch((error) => {
            console.error('Error restarting video:', error);
        });
}

function handleCandidate(candidate) {
	if (yourConn.remoteDescription && yourConn.remoteDescription.type) {
		yourConn.addIceCandidate(new RTCIceCandidate(candidate)).catch(errorHandler);
	} else {
		candidateQueue.push(candidate);
	}
}

function handleLeave() {
	handelHangUp();
}

function handelHangUp() {
	connectedUser = null;
	//showRemoteUsername.innerHTML = '';
	localUser = 
	send({
		type: 'hangup',
		name: localUser,
	});


	yourConn.close();

	// Reset the connection
	yourConn = new RTCPeerConnection(peerConnectionConfig);
	setupConnection(localStream);
}

// 送出訊息按鈕事件
sendButton.addEventListener("click", () => {
    /*const message = chatMessage.value.trim();
    if (message !== "") {
        addMessageToChat("船主❤", message);
        chatMessage.value = ""; // 清空輸入框
    }*/
	const message = chatMessage.value.trim();
	if (message !== "") {
	const data = {
	    type: 'chat',
	    name: "船主❤ " + localUser, // 假設 localUser 是用戶名
	    message: message,
	};
	serverConnection.send(JSON.stringify(data));  // 發送聊天訊息到 WebSocket 伺服器
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
