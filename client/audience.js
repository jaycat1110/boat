/** @type {RTCPeerConnection} */
let yourConn;
let candidateQueue = [];

let localUser;
let localStream;
let connectedUser;
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

const peerConnectionConfig = {
	iceServers: [{ urls: 'stun:stun.stunprotocol.org:3478'}, { urls: 'stun:stun.l.google.com:19302' }],
};

serverConnection.onopen = () => {
	console.log('Connected to the signaling server');
};

serverConnection.onmessage = gotMessageFromServer;

//const startwatch = document.getElementById("startwatch");	//
const audienceSection = document.getElementById("audienceSection");//船客資料設定介面
const audienceChoosing = document.getElementById("audienceChoosing");//船客選船設定
const remoteVideo = document.getElementById('remoteVideo');	//船艙開趴遠端視訊
const audienceView = document.getElementById("audienceView");//船艙開趴介面
const endofcall = document.getElementById("endofcall");//主播結束通話
const hostToWatchInput = document.getElementById('hostToWatchInput');//船客要上哪個船長的船 輸入框
const showRemoteUsername = document.getElementById('showRemoteUserName');//顯示船長名稱
const allhosts = document.getElementById('allhosts');//所有使用者名稱
const chatWindow = document.getElementById("chatWindow");
const chatMessage = document.getElementById("chatMessage");
const emojiButton = document.getElementById('emojiButton');
const emojiPicker = document.getElementById('emojiPicker');
const sendButton = document.getElementById("sendButton");

//要包在確認名稱正確的function內
document.addEventListener("DOMContentLoaded", () => {

	audienceChoosing.style.display = "none";
	audienceView.style.display = "none";
	endofcall.style.display = "block";
    // 當進入此畫面時隱藏直播畫面
});


window.addEventListener('beforeunload', () => {
	serverConnection.close();
});

function callBtnClick() {
	const hostToWatch = hostToWatchInput.value;
	connectedUser = hostToWatch;
	if (hostToWatch.length > 0) {
		connectedUser = hostToWatch;
		console.log('create an offer to ', hostToWatch);
		console.log('connection state', yourConn.connectionState);
		console.log('signalling state', yourConn.signalingState);
		
		yourConn
			.createOffer()
			.then((offer) => {
				yourConn.setLocalDescription(offer).then(
					send({
						type: 'offer',
						name: connectedUser,
						offer: offer,
					})
				);
			})
			.catch((error) => {
				alert('Error when creating an offer', error);
				console.error('Error when creating an offer', error);
			});
	} else alert("username can't be blank!");
}


function gotMessageFromServer(message) {
	console.log('Got message', message.data);
	const data = JSON.parse(message.data);

	switch (data.type) {
		case 'login':
			handleLogin(data.success, data.allhosts /*,  data.share */);
			break;
		//when somebody wants to call us
		case 'offer':
			handleOffer(data.offer, data.name);
			break;
		case 'answer':
			handleAnswer(data.answer);
			break;
		case 'decline':
			handleDecline(data.message);
			break;
		//when a remote peer sends an ice candidate to us
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
			console.log(message);
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
	callBtnClick();
}

function setupConnection(stream) {
	yourConn = new RTCPeerConnection(peerConnectionConfig);
	const hostToWatch = hostToWatchInput.value;
	connectedUser = hostToWatch;

	
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
		};
		yourConn.onicecandidateerror = (event) => {
			console.error('ICE Candidate Error:', event);
		};
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
 * @param {'m'} mediaType
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
		audienceChoosing.style.display = "none";
		audienceView.style.display = "block";//位置需調整
	} 
	else {
		console.error('Invalid mediaType');
	}

}

function Login() {
	localUser = audiencenameInput.value;
	if (localUser.length > 0) {
		send({
			type: 'login',
			name: localUser,
		});
	} 
	else {
        alert('Username cannot be blank!');
	}
}

function handleLogin(success , allhosts/*,  share */) {
	if (success === false) {
		alert('Oops...try a different username，小心上了賊船');
		return;
	}
	else{
		
		audienceSection.style.display = "none";
		audienceChoosing.style.display = "block";
		
	}
	refreshUserList(allhosts);

	
}

function handleOffer(offer, name) {
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

function handleAnswer(answer) {
	console.log('answer: ', answer);
	
	yourConn
		.setRemoteDescription(new RTCSessionDescription(answer))
		.catch(errorHandler);
}

function handleDecline(message) {
	audienceSection.style.display = "none";
	audienceChoosing.style.display = "block";
	audienceView.style.display = "none";
	alert(message);
}

function handleCandidate(candidate) {
	if (yourConn.remoteDescription) {
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
	remoteVideo.src = null;
	remoteVideo.hidden = true;
	showRemoteUsername.innerHTML = '';

	yourConn.close();
	endofcall.innerHTML = "直播已結束";
	// Reset the connection
	yourConn = new RTCPeerConnection(peerConnectionConfig);
	setupConnection(localStream);
	
}
/**
 * @param {string[]} allhosts
 */
function refreshUserList(allhosts) {
	const allAvailableUsers = allhosts && Array.isArray(allhosts) ? allhosts.join(',') : '';
	console.log('All available users', allAvailableUsers);
	allhosts.innerHTML = allAvailableUsers;
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

// 送出訊息按鈕事件
sendButton.addEventListener("click", () => {
    const message = chatMessage.value.trim();
    if (message !== "") {
        addMessageToChat(localUser, message);
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
