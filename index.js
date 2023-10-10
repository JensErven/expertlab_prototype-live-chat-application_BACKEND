import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const clients = new Set(); // Store connected clients
const users = new Map(); // Store user names
const rooms = new Map(); // Store chat rooms

wss.on("connection", function connection(ws) {
  let username = null; // The name of the connected user

  ws.on("message", function message(data) {
    const messageData = JSON.parse(data);

    if (messageData.type === "name") {
      // Set the username when the user provides their name
      username = messageData.username;
      users.set(username, ws);
      clients.add(ws);

      // Send the list of all logged-in users to the connected client
      const userArray = Array.from(users.keys());
      ws.send(JSON.stringify({ type: "userList", users: userArray }));
    } else if (messageData.type === "createRoom") {
      // Create a new chat room with the provided room name
      const roomName = messageData.roomName;
      rooms.set(roomName, new Set([username]));
      ws.send(JSON.stringify({ type: "roomCreated", roomName }));
    } else if (messageData.type === "joinRoom") {
      // Join a chat room
      const roomName = messageData.roomName;
      if (rooms.has(roomName)) {
        rooms.get(roomName).add(username);
        ws.send(JSON.stringify({ type: "roomJoined", roomName }));
      }
    } else if (messageData.type === "leaveRoom") {
      // Leave a chat room
      const roomName = messageData.roomName;
      if (rooms.has(roomName)) {
        rooms.get(roomName).delete(username);
        ws.send(JSON.stringify({ type: "roomLeft", roomName }));
      }
    } else if (messageData.type === "chat" && messageData.roomName) {
      // Handle chat messages within a room and send them to all participants
      const roomName = messageData.roomName;
      const messageText = messageData.message;

      if (rooms.has(roomName) && rooms.get(roomName).has(username)) {
        rooms.get(roomName).forEach((participant) => {
          if (users.has(participant)) {
            users.get(participant).send(
              JSON.stringify({
                type: "chat",
                roomName,
                sender: username,
                message: messageText,
              })
            );
          }
        });
      }
    }
  });

  ws.on("close", () => {
    // Remove the disconnected user from the users map and clients set
    users.delete(username);
    clients.delete(ws);

    // Leave all chat rooms that the user was a part of
    rooms.forEach((participants, roomName) => {
      if (participants.has(username)) {
        participants.delete(username);
        if (participants.size === 0) {
          // If no participants left, remove the room
          rooms.delete(roomName);
        }
      }
    });

    // Notify other users about the disconnect
    broadcastUserList();
  });

  // Send a welcome message to the connected client
  ws.send(
    JSON.stringify({
      type: "welcome",
      message: "Welcome to the chat app. Please provide your name.",
    })
  );
});

// Broadcast a list of all logged-in users to all connected clients
function broadcastUserList() {
  const userArray = Array.from(users.keys());
  const roomArray = Array.from(rooms.keys());
  clients.forEach((client) => {
    client.send(JSON.stringify({ type: "userList", users: userArray }));
    client.send(JSON.stringify({ type: "rooms", rooms: roomArray }));
  });
}

// Periodically send updates to all connected clients
setInterval(async () => {
  broadcastUserList();
}, 10000); // Update every 10 seconds
