import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routers/auth.js";
import usersRouter from "./routers/users.js";
import chatsRouter from "./routers/chats.js";
import messagesRouter from "./routers/messages.js";

import { db } from "./db.js";
import jwt from "jsonwebtoken";
import url from "url";

const app = express();
app.use(cookieParser());
app.use(
  cors({
    origin: 
      "https://fullstuck-chat-render-client.onrender.com/",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/messages", messagesRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server: server });

const connections = {};
const users = {};

export const handleSendMessage = (message, userId) => {
  const messageObj = JSON.stringify(message);
  if (connections[userId]) connections[userId].send(messageObj);
};

const handleClose = (uid) => {
  delete connections[uid];
  delete users[uid];
};

const handleIsOnline = (uid) => {
  const q = "SELECT * FROM chatUsers WHERE chatUserId=?";
  db.query(q, [uid], (err, data) => {
    if (err && connections[uid])
      return connections[uid].send(JSON.stringify(["error", "incorrect user"]));

    const chatsIds = data.map((chat) => {
      return chat.chatId;
    });
    const q = "SELECT * FROM chatUsers WHERE chatId IN (?) AND chatUserId != ?";
    db.query(q, [chatsIds, uid], (err, data) => {
      if (err && connections[uid])
        return connections[uid].send(
          JSON.stringify(["error", "incorrect user"])
        );
      let usersInChatOnline = {};
      [...data].forEach((user) => {
        if (users[user.chatUserId])
          return (usersInChatOnline[user.chatUserId] = users[user.chatUserId]);
      });
      usersInChatOnline[uid] = users[uid];
      console.log(usersInChatOnline);
      Object.keys(usersInChatOnline).forEach((key, index) => {
        if (usersInChatOnline[key])
          return handleSendMessage(
            ["sendUsersOnline", usersInChatOnline],
            usersInChatOnline[key].id
          );
      });
      handleSendMessage(["sendUsersOnline", usersInChatOnline], uid);
    });
  });
};

app.get("/", (req, res) => {
  if (!req.cookies?.access_token) return res.status(401).json("Anauthorized!");
});

wss.on("connection", (connection, request) => {
  if (!request.headers.cookie) return;
  const token = request.headers.cookie.split("access_token")[1].split("=")[1];
  const userId = url.parse(request.url, true).query.user;
  jwt.verify(token, "jwtkey", (err, userInfo) => {
    if (err) return console.log(err);
    if (userId == userInfo.id) {
      connection.on("close", () => {
        handleClose(userInfo.id), console.log("user disconnected!");
        handleIsOnline(userInfo.id);
      });
      const q = "SELECT * FROM users WHERE id = ?";
      db.query(q, [userInfo.id], (err, data) => {
        if (err) return connection.send("failed to access userdata!");
        if (data.length < 1) return;
        if (!connections[userInfo.id]) connections[userInfo.id] = connection;
        const { password, email, ...other } = data[0];
        if (Object.keys(users).length < Object.keys(connections).length)
          users[userInfo.id] = other;
        handleIsOnline(userInfo.id);
        const q = "SELECT * FROM notifications WHERE userId=? AND isRead=?";
        db.query(q, [userInfo.id, 0], (err, data) => {
          if (err)
            return (
              connection.send(["error", "Error connecting to the server!"]),
              console.log(err)
            );
          if (data.length < 1) return;
          const chatIds = data;
          connections[userInfo.id].send(
            JSON.stringify(["sendNotification", chatIds])
          );
        });
        // console.log(users, Object.keys(connections).length);
      });
    }
  });
});

server.listen(process.env.PORT, () => {
  console.log("Server is running on PORT: " + process.env.PORT);
});
