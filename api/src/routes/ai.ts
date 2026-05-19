import express from "express"

const router = express.Router()

router.post("/process", async (req, res) => {

  const { prompt, model } = req.body

  // RESPUESTA TEMPORAL (IA falsa mientras conectamos modelo real)

  const text = `AI Response for: ${prompt}`

  res.json({
    text,
    tokens: prompt.length,
    model: model || "cloud",
    processingTime: 50
  })

})

export default router
