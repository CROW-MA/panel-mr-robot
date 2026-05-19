import express from "express"
import { pool } from "../db"

const router = express.Router()

// guardar datos scrapeados
router.post("/scrape", async (req, res) => {
  try {
    const { title, url, content } = req.body

    await pool.query(
      `INSERT INTO scraped_data (title,url,content,created_at)
       VALUES ($1,$2,$3,NOW())`,
      [title, url, content]
    )

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "scrape failed" })
  }
})

// obtener datos
router.get("/data", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM scraped_data ORDER BY created_at DESC LIMIT 50"
  )

  res.json(rows)
})

export default router
