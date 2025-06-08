import { db } from "../db.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import url from "url";
import jwt from "jsonwebtoken";

export const register = (req, res) => {
  if (
    req.body.username?.length < 4 ||
    req.body.password?.length < 8 ||
    !req.body.username ||
    !req.body.password
  )
    return res.status(400).json("Invalid username or password");
  const q = "SELECT * FROM users WHERE email = ? OR username = ?";
  db.query(q, [req.body.email, req.body.username], (err, data) => {
    if (err) return res.status(401).json("Invalid username or email");
    if (data.length > 0)
      return res.status(500).json("Such user already exists");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      secure: true,
      port: 465,
      auth: {
        pass: "hjdn mwab yfqm acsd",
        user: "mgznlidia2@gmail.com",
      },
    });

    const emailSalt = bcrypt.genSaltSync(10);
    const emailBycripted = bcrypt.hashSync(req.body.email, emailSalt);

    const mailOptions = {
      from: "mgznlidia2@gmail.com",
      to: req.body.email,
      subject: "Verify your account!",
      text: `Verify your account by opening this link: ${process.env.CLIENT_URL}verify?username=${req.body.username}&email=${emailBycripted}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) return res.status(401).json("Invalid email"), console.log(err);
      const q =
        "INSERT INTO users (`username`, `email`, `password`) VALUES (?)";
      const passSalt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(req.body.password, passSalt);
      db.query(
        q,
        [[req.body.username, req.body.email, hashPassword]],
        (err, data) => {
          if (err)
            return (
              res.status(401).json("Faliled saving user!"), console.log(err)
            );
          return res.status(200).json("User saved successfully!");
        }
      );
      return console.log("Successfuly sent to: " + info.response);
    });
  });
};

export const verify = (req, res) => {
  const { email, username } = url.parse(req.url, true).query;
  const q = "SELECT * FROM users WHERE username=?";
  db.query(q, [username], (err, data) => {
    if (err) return res.status(401).json("Invalid link!");
    if (data.length < 1)
      return res.status(401).json("No such user registered!");
    if (data[0].isVerified)
      return res.status(401).json("User already verified!");
    if (!bcrypt.compareSync(data[0].email, email))
      return res.status(401).json("Incorrect verification link!");
    const q = "UPDATE users SET isVerified=? WHERE email=?";
    db.query(q, [1, data[0].email], (err, data) => {
      if (err)
        return res.status(401).json("Failed to verify user"), console.log(err);
      return res.status(200).json("Account verified successfully!");
    });
  });
};

export const login = (req, res) => {
  if (!req.body.password)
    return res.status(400).json("Invalid username or password");
  const q = "SELECT * FROM users WHERE email = ?";
  db.query(q, [req.body.email], (err, data) => {
    if (err) return res.status(401).json("Invalid email");
    if (data.length < 1) return res.status(500).json("No such user exists!");

    if (!bcrypt.compareSync(req.body.password, data[0].password))
      return res.status(403).json("Incorrect pasword!");
    const { password, ...other } = data[0];
    const token = jwt.sign({ id: data[0].id }, "jwtkey");
    return res
      .status(200)
      .cookie("access_token", token, { 
        httpOnly: true, 
        secure: true,
        sameSite: "None",
        path: "/"
      })
      .json(other);
  });
};

export const logout = (req, res) => {
  res.clearCookie("access_token");
  res.status(200).json("Successfully logout!");
};
