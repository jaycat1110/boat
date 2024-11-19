// chatroom.js
const ws = new WebSocket("ws://你的伺服器IP:PORT/ws");
const messagesDisplay = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");

// 當 WebSocket 連線成功
ws.onopen = () => {
  console.log("WebSocket 連接成功！");
};

// 當接收到訊息時
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const newMessage = document.createElement("div");
  newMessage.textContent = `${message.user}: ${message.text}`;
  messagesDisplay.appendChild(newMessage);
};

// 當按下發送按鈕時
sendButton.onclick = () => {
  const message = chatInput.value;
  if (message.trim() !== "") {
    ws.send(JSON.stringify({ type: "chat", user: "Guest", text: message }));
    chatInput.value = "";
  }
};
