const { Pool } = require("pg");
require("dotenv").config();

// O Pool lê a URI completa diretamente da variável DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Mantém a conexão criptografada segura
});

// Teste rápido de comunicação
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Erro de conexão com o banco:", err.message);
  } else {
    console.log("CONEXÃO ESTABELECIDA COM SUCESSO COM O SUPABASE!");
  }
});

module.exports = pool;
