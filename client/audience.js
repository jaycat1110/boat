let yourConn;
let connectedUser;
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');

const peerConnectionConfig = {
	iceServers: [{ urls: 'stun:stun.stunprotocol.org:3478' }, { urls: 'stun:stun.l.google.com:19302' }],
};

serverConnection.onmessage = gotMessageFromServer;

//const startwatch = document.getElementById("startwatch");	//
const audienceSection = document.getElementById("audienceSection");//船客資料設定介面
const audienceChoosing = document.getElementById("audienceChoosing");//船客選船設定
const remoteVideo = document.getElementById('remoteVideo');	//船艙開趴遠端視訊
const audienceView = document.getElementById("audienceView");//船艙開趴介面
const hostToWatchInput = document.getElementById('hostToWatchInput');//船客要上哪個船長的船 輸入框
const showRemoteUsername = document.getElementById('showRemoteUserName');//顯示船長名稱
const allhosts = document.getElementById('allhosts');//所有使用者名稱


const chatWindow = document.getElementById("chatWindow");//聊天室
const chatMessage = document.getElementById("chatMessage");
const sendButton = document.getElementById("sendButton");

//要包在確認名稱正確的function內
document.addEventListener("DOMContentLoaded", () => {

	audienceChoosing.style.display = "none";
	audienceView.style.display = "none";
    // 當進入此畫面時隱藏直播畫面
});

function callBtnClick() {
	const hostToWatch = hostToWatchInput.value;

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

				audienceSection.style.display = "none";
				audienceView.style.display = "block";
			})
			.catch((error) => {
				alert('Error when creating an offer', error);
				console.error('Error when creating an offer', error);
			});
	} else alert("username can't be blank!");
}

window.addEventListener('beforeunload', () => {
	serverConnection.close();
});

function gotMessageFromServer(message) {
	console.log('Got message', message.data);
	const data = JSON.parse(message.data);

	switch (data.type) {
		case 'login':
			handleLogin(data.success/*, data.allUsers,  data.share */);
			break;
		//when somebody wants to call us
		case 'offer':
			handleOffer(data.offer, data.name);
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
	yourConn.ontrack = (event) => {
		console.log('got remote stream');
		showRemoteUsername.innerHTML = connectedUser;
		remoteVideo.srcObject = event.streams[0];
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

function handleLogin(success /*, allhosts,  share */) {
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
	// Remove existing event listeners
	startwatch.removeEventListener('click', handleWatchClick);

	// Define the event handler functions
	function handleWatchClick() {
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
    answerBtn.addEventListener('click', handleWatchClick);
}

function handleAnswer(answer) {
	console.log('answer: ', answer);
	yourConn
		.setRemoteDescription(new RTCSessionDescription(answer))
		.then(() => {
			while (candidateQueue.length) {
				const candidate = candidateQueue.shift();
				yourConn.addIceCandidate(new RTCIceCandidate(candidate)).catch(errorHandler);
			}
		})
		.catch(errorHandler);
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

	// Reset the connection
	yourConn = new RTCPeerConnection(peerConnectionConfig);
	setupConnection(localStream);
}
/**
 * @param {string[]} users
 */
function refreshUserList(users) {
	const allAvailableUsers = users && Array.isArray(users) ? users.join(',') : '';
	console.log('All available users', allAvailableUsers);
	allhosts.innerHTML = allAvailableUsers;
}