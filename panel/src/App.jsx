import { useState } from "react";
import { api } from "./api";
import { Container, TextField, Button, Typography, Box } from "@mui/material";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    alert("Login correcto");
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} p={4} boxShadow={3} borderRadius={3}>
        <Typography variant="h4" gutterBottom>
          WAAS Dashboard
        </Typography>

        <TextField
          label="Email"
          fullWidth
          margin="normal"
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          label="Password"
          type="password"
          fullWidth
          margin="normal"
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button variant="contained" fullWidth onClick={login}>
          Login
        </Button>
      </Box>
    </Container>
  );
}
