import { db } from "../db.js";
import url from "url";

export const getUser = (req, res) => {
  const userReqData = url.parse(req.url, true).query;
  // console.log(userReqData.username);
  const q = "SELECT * FROM users WHERE username=?";
  db.query(q, [userReqData.username], (err, data) => {
    if (err) return res.status(401).json("No such user exists!");
    if (data.length < 1) return res.status(401).json("No such user exists!");
    const { password, email, isVerified, ...other } = data[0];
    return res.status(200).json(other);
  });
};

export const getUsers = (req, res) => {
  const userReqData = url.parse(req.url, true).query;
  if (userReqData.username < 1) return res.status(200).json([]);
  const q = "SELECT * FROM users WHERE username LIKE ?";
  db.query(q, [userReqData.username + "%"], (err, data) => {
    if (err)
      return res.status(404).json("No such user found"), console.log(err);
    const users = [...data].map((user) => {
      const { password, email, isVerified, ...other } = user;
      return other;
    });
    return res.status(200).json(users);
  });
};
