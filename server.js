// npm run dev
const express = require("express");
const pool = require("./database"); // O arquivo de conexão que criamos antes
require("dotenv").config();

const app = express();
const bcrypt = require("bcrypt");

const cors = require("cors");
app.use(cors()); // Libera o acesso para qualquer origem (front-end)

// Middleware para permitir que o Express entenda requisições no formato JSON
app.use(express.json());

// Rota de teste inicial para garantir que o servidor está rodando
app.get("/", async (req, res) => {
  try {
    // Faz uma consulta simples para tentar ler a tabela de livros
    const resultado = await pool.query("SELECT * FROM livro");

    res.json({
      status: "Sucesso!",
      mensagem: "O servidor Node.js conectou perfeitamente ao Supabase!",
      total_livros_no_banco: resultado.rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "Erro",
      mensagem:
        "O servidor rodou, mas não conseguiu conversar com o banco de dados.",
    });
  }
});

// ==========================================
// ROTA: Buscar todos os livros (GET) - ATUALIZADA
// ==========================================
app.get("/livros", async (req, res) => {
  try {
    // Incluindo os novos campos e trazendo o nome de quem pegou via LEFT JOIN
    const queryTxt = `
      SELECT 
        l.id, 
        l.titulo, 
        l.autor, 
        l.foto_url, 
        l.status, 
        l.usuario_emprestimo,
        l.editora,
        l.ano,
        l.descricao,
        l.idioma,
        l.encadernacao,
        l.dimensao,
        l.peso,
        u.nome AS nome_emprestimo
      FROM livro l
      LEFT JOIN usuario u ON l.usuario_emprestimo = u.id
      ORDER BY l.id ASC
    `;

    const resultado = await pool.query(queryTxt);
    res.json(resultado.rows);
  } catch (err) {
    console.error("Erro ao buscar livros:", err);
    res.status(500).json({
      error: "Erro interno do servidor ao buscar os livros.",
    });
  }
});

// ==========================================
// ROTA: Buscar livro por ID (GET) - ATUALIZADA
// ==========================================
app.get("/livros/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Atualizado com LEFT JOIN para que a tela de detalhes receba também o nome de quem pegou
    const queryTxt = `
      SELECT 
        l.id, 
        l.titulo, 
        l.autor, 
        l.foto_url, 
        l.status, 
        l.usuario_emprestimo,
        l.editora,
        l.ano,
        l.descricao,
        l.idioma,
        l.encadernacao,
        l.dimensao,
        l.peso,
        u.nome AS nome_emprestimo
      FROM livro l
      LEFT JOIN usuario u ON l.usuario_emprestimo = u.id
      WHERE l.id = $1
    `;

    const resultado = await pool.query(queryTxt, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error: `Livro com o ID ${id} não foi encontrado.`,
      });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    console.error(`Erro ao buscar o livro com ID ${req.params.id}:`, err);
    res.status(500).json({
      error: "Erro interno do servidor ao buscar o livro.",
    });
  }
});

// ==========================================
// ROTA: Deletar um livro pelo ID (DELETE)
// ==========================================
app.delete("/livros/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      "DELETE FROM livro WHERE id = $1 RETURNING *",
      [id],
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error: `Não foi possível deletar: livro com o ID ${id} não foi encontrado.`,
      });
    }

    res.json({
      status: "Sucesso!",
      mensagem: `O livro "${resultado.rows[0].titulo}" foi deletado com sucesso.`,
    });
  } catch (err) {
    console.error(`Erro ao deletar o livro com ID ${req.params.id}:`, err);
    res.status(500).json({
      error: "Erro interno do servidor ao tentar deletar o livro.",
    });
  }
});

// ==========================================
// ROTA: Cadastrar um novo livro (POST) - ATUALIZADA
// ==========================================
app.post("/livros", async (req, res) => {
  try {
    const {
      titulo,
      autor,
      foto_url,
      status,
      data_emprestimo,
      usuario_emprestimo,
      editora, // Obrigatório
      ano, // Obrigatório
      descricao, // Obrigatório
      idioma, // Opcional
      encadernacao, // Opcional
      dimensao, // Opcional
      peso, // Opcional
    } = req.body;

    // Validação estrita dos requisitos obrigatórios de negócio
    if (!titulo || !editora || !ano || !descricao) {
      return res.status(400).json({
        error:
          "Os campos 'titulo', 'editora', 'ano' e 'descricao' são obrigatórios.",
      });
    }

    const statusLivro = status || "disponivel";

    // Query expandida para salvar a estrutura completa de metadados
    const queryTxt = `
      INSERT INTO livro (
        titulo, autor, foto_url, status, data_emprestimo, usuario_emprestimo,
        editora, ano, descricao, idioma, encadernacao, dimensao, peso
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const valores = [
      titulo,
      autor || null,
      foto_url || null,
      statusLivro,
      data_emprestimo || null,
      usuario_emprestimo || null,
      editora,
      ano,
      descricao,
      idioma || "Português (pt-BR)", // Valores padrão se vier vazio
      encadernacao || "Capa Comum",
      dimensao || null,
      peso || null,
    ];

    const resultado = await pool.query(queryTxt, valores);

    res.status(201).json({
      status: "Sucesso!",
      mensagem: "Livro cadastrado com sucesso.",
      livro: resultado.rows[0],
    });
  } catch (err) {
    console.error("Erro ao cadastrar livro:", err);
    res.status(500).json({
      error: "Erro interno do servidor ao tentar cadastrar o livro.",
    });
  }
});

// ==========================================
// ROTA: Cadastrar um novo usuário
// ==========================================
app.post("/usuarios", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res
        .status(400)
        .json({ error: "Todos os campos são obrigatórios." });
    }

    const saltRounds = 10;
    const senhaCriptografada = await bcrypt.hash(senha, saltRounds);

    const queryTxt =
      "INSERT INTO usuario (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email";
    const resultado = await pool.query(queryTxt, [
      nome,
      email,
      senhaCriptografada,
    ]);

    res.status(201).json({
      status: "Sucesso!",
      usuario: resultado.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar usuário." });
  }
});

// ==========================================
// ROTA: Autenticação de Login
// ==========================================
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res
        .status(400)
        .json({ error: "E-mail e senha são obrigatórios." });
    }

    const resultado = await pool.query(
      "SELECT * FROM usuario WHERE email = $1",
      [email],
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const usuario = resultado.rows[0];
    const senhaBatem = await bcrypt.compare(senha, usuario.senha);

    if (!senhaBatem) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    res.json({
      status: "Sucesso!",
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Erro interno no servidor ao tentar logar." });
  }
});

// ==========================================
// ROTA: Pegar um livro emprestado (PUT)
// ==========================================
app.put("/livros/:id/emprestar", async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_completo } = req.body;

    if (!nome_completo) {
      return res.status(400).json({
        error: "O nome completo é obrigatório para realizar o empréstimo.",
      });
    }

    const livroCheck = await pool.query(
      "SELECT status FROM livro WHERE id = $1",
      [id],
    );

    if (livroCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Livro com o ID ${id} não foi encontrado.` });
    }

    if (livroCheck.rows[0].status === "emprestado") {
      return res
        .status(400)
        .json({ error: "Este livro já está emprestado para outra pessoa." });
    }

    let usuarioId = null;
    const usuarioCheck = await pool.query(
      "SELECT id FROM usuario WHERE nome = $1",
      [nome_completo],
    );

    if (usuarioCheck.rows.length > 0) {
      usuarioId = usuarioCheck.rows[0].id;
    } else {
      const novoUsuario = await pool.query(
        "INSERT INTO usuario (nome, email, senha) VALUES ($1, $2, 'PROVISORIO') RETURNING id",
        [
          nome_completo,
          `${nome_completo.toLowerCase().replace(/\s+/g, "")}@biblioteca.com`,
        ],
      );
      usuarioId = novoUsuario.rows[0].id;
    }

    const queryTxt = `
      UPDATE livro 
      SET status = 'emprestado', 
          usuario_emprestimo = $1, 
          data_emprestimo = NOW() 
      WHERE id = $2 
      RETURNING *
    `;

    const resultado = await pool.query(queryTxt, [usuarioId, id]);

    res.json({
      status: "Sucesso!",
      mensagem: `O livro "${resultado.rows[0].titulo}" foi emprestado com sucesso.`,
      livro: resultado.rows[0],
    });
  } catch (err) {
    console.error(
      `Erro ao processar empréstimo do livro ${req.params.id}:`,
      err,
    );
    res.status(500).json({
      error: "Erro interno do servidor ao tentar processar o empréstimo.",
    });
  }
});

// ==========================================
// ROTA: Devolver um livro (PUT)
// ==========================================
app.put("/livros/:id/devolver", async (req, res) => {
  try {
    const { id } = req.params;

    const livroCheck = await pool.query(
      "SELECT status FROM livro WHERE id = $1",
      [id],
    );

    if (livroCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Livro com o ID ${id} não foi encontrado.` });
    }

    if (livroCheck.rows[0].status === "disponivel") {
      return res
        .status(400)
        .json({ error: "Este livro já está disponível na biblioteca." });
    }

    const queryTxt = `
      UPDATE livro 
      SET status = 'disponivel', 
          usuario_emprestimo = NULL, 
          data_emprestimo = NULL 
      WHERE id = $1 
      RETURNING *
    `;

    const resultado = await pool.query(queryTxt, [id]);

    res.json({
      status: "Sucesso!",
      mensagem: `O livro "${resultado.rows[0].titulo}" foi devolvido com sucesso.`,
      livro: resultado.rows[0],
    });
  } catch (err) {
    console.error(
      `Erro ao processar devolução do livro ${req.params.id}:`,
      err,
    );
    res.status(500).json({
      error: "Erro interno do servidor ao tentar processar a devolução.",
    });
  }
});

// Definir a porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`);
});
