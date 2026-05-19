import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("Loading...");
  const [time, setTime] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.status);
        setTime(data.db?.now || "");
      })
      .catch(() => setStatus("API connection failed"));
  }, []);

  return (
    <div style={{
      fontFamily: "Arial",
      background: "#0f172a",
      color: "white",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column"
    }}>
      <h1>MR.R0B0T WAAS PANEL</h1>

      <div style={{
        background:"#1e293b",
        padding:"20px",
        borderRadius:"10px",
        marginTop:"20px"
      }}>
        <p><b>API STATUS:</b> {status}</p>
        <p><b>DB TIME:</b> {time}</p>
      </div>
    </div>
  );
}

export default App;
