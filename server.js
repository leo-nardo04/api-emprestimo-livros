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
    // Faz uma consulta simples para tentar ler a tabela de livros (que está vazia)
    const resultado = await pool.query("SELECT * FROM LIVRO");

    res.json({
      status: "Sucesso!",
      mensagem: "O servidor Node.js conectou perfeitamente ao Supabase!",
      total_livros_no_banco: resultado.rows.length, // Deve retornar 0
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

app.get("/livros", async (req, res) => {
  try {
    // O LEFT JOIN busca o nome da tabela usuario associado ao usuario_emprestimo, se existir
    const queryTxt = `
      SELECT 
        l.id, 
        l.titulo, 
        l.autor, 
        l.foto_url, 
        l.status, 
        l.usuario_emprestimo,
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

app.get("/livros/:id", async (req, res) => {
  try {
    const { id } = req.params; // Pega o ID enviado na URL

    // Faz o SELECT buscando apenas o ID correspondente
    const resultado = await pool.query("SELECT * FROM livro WHERE id = $1", [
      id,
    ]);

    // Se não encontrar nenhum livro, retorna status 404 (Não Encontrado)
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error: `Livro com o ID ${id} não foi encontrado.`,
      });
    }

    // Retorna apenas o objeto do livro encontrado (a primeira linha do array)
    res.json(resultado.rows[0]);
  } catch (err) {
    console.error(`Erro ao buscar o livro com ID ${req.params.id}:`, err);
    res.status(500).json({
      error: "Erro interno do servidor ao buscar o livro.",
    });
  }
});

// ==========================================
// ROTA: Deletar um livro pelo ID
// ==========================================
app.delete("/livros/:id", async (req, res) => {
  try {
    const { id } = req.params; // Pega o ID enviado na URL

    // Executa o DELETE e usa o RETURNING * para saber se alguma linha foi afetada
    const resultado = await pool.query(
      "DELETE FROM livro WHERE id = $1 RETURNING *",
      [id],
    );

    // Se o array 'rows' vier vazio, significa que o ID não existia no banco
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error: `Não foi possível deletar: livro com o ID ${id} não foi encontrado.`,
      });
    }

    // Retorna uma mensagem de sucesso confirmando qual livro foi deletado
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
// ROTA: Cadastrar um novo livro
// ==========================================

// {
//   "titulo": "Admirável Mundo Novo",
//   "autor": "Aldous Huxley",
//   "foto_url": "https://vcqqsrdbypalxehimeej.supabase.co/storage/v1/object/public/capas-livros/Admiravel_Mundo_Novo.jpg"
// }
app.post("/livros", async (req, res) => {
  try {
    // Pega os dados enviados no corpo (body) da requisição
    const {
      titulo,
      autor,
      foto_url,
      status,
      data_emprestimo,
      usuario_emprestimo,
    } = req.body;

    // Validação simples: o título é obrigatório para cadastrar um livro
    if (!titulo) {
      return res.status(400).json({
        error: "O campo 'titulo' é obrigatório.",
      });
    }

    // Se o status não for enviado, define o padrão como 'disponivel'
    const statusLivro = status || "disponivel";

    // Query para inserir no banco. O RETURNING * nos devolve o livro com o ID gerado automaticamente.
    const queryTxt = `
      INSERT INTO livro (titulo, autor, foto_url, status, data_emprestimo, usuario_emprestimo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const valores = [
      titulo,
      autor || null,
      foto_url || null,
      statusLivro,
      data_emprestimo || null,
      usuario_emprestimo || null,
    ];

    const resultado = await pool.query(queryTxt, valores);

    // Retorna o status 201 (Created) e o objeto do livro recém-criado
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
// ROTA: Cadastrar um novo usuário com senha segura
// ==========================================
app.post("/usuarios", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res
        .status(400)
        .json({ error: "Todos os campos são obrigatórios." });
    }

    // Criptografa a senha gerando um "hash"
    const saltRounds = 10;
    const senhaCriptografada = await bcrypt.hash(senha, saltRounds);

    // Insere no banco de dados
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

    // Busca o usuário pelo e-mail
    const resultado = await pool.query(
      "SELECT * FROM usuario WHERE email = $1",
      [email],
    );

    // Se não achar o e-mail
    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const usuario = resultado.rows[0];

    // Compara a senha digitada com a senha criptografada do banco
    const senhaBatem = await bcrypt.compare(senha, usuario.senha);

    if (!senhaBatem) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    // Login feito com sucesso! Retorna os dados do usuário (menos a senha)
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
    const { id } = req.params; // ID do livro enviado na URL
    const { usuario_id } = req.body; // ID do usuário que está pegando o livro

    // Validação inicial: precisamos saber quem está pegando o livro
    if (!usuario_id) {
      return res.status(400).json({
        error: "O campo 'usuario_id' é obrigatório para realizar o empréstimo.",
      });
    }

    // 1. VERIFICAÇÃO: Busca o status atual do livro no banco
    const livroCheck = await pool.query(
      "SELECT status FROM livro WHERE id = $1",
      [id],
    );

    // Se o livro não existir no banco
    if (livroCheck.rows.length === 0) {
      return res.status(404).json({
        error: `Livro com o ID ${id} não foi encontrado.`,
      });
    }

    // Se o status já for 'emprestado', impede o novo empréstimo imediatamente
    if (livroCheck.rows[0].status === "emprestado") {
      return res.status(400).json({
        error: "Este livro já está emprestado para outra pessoa.",
      });
    }

    // 2. AÇÃO: Se estiver disponível, atualiza o status, grava o ID do usuário e a data atual (NOW())
    const queryTxt = `
      UPDATE livro 
      SET status = 'emprestado', 
          usuario_emprestimo = $1, 
          data_emprestimo = NOW() 
      WHERE id = $2 
      RETURNING *
    `;

    const resultado = await pool.query(queryTxt, [usuario_id, id]);

    // Retorna a resposta de sucesso com os dados atualizados do livro
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
// ROTA: Devolver um livro (PUT) com Validação de Usuário
// ==========================================
app.put("/livros/:id/devolver", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id } = req.body; // Recebe quem está tentando fazer a devolução

    if (!usuario_id) {
      return res.status(400).json({
        error: "O 'usuario_id' é obrigatório para processar a devolução.",
      });
    }

    // 1. Busca o livro e verifica quem está em posse dele
    const livroCheck = await pool.query(
      "SELECT status, usuario_emprestimo FROM livro WHERE id = $1",
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

    // TRAVA DE SEGURANÇA NO BANCO:
    // Se o ID de quem está mandando a requisição for diferente do ID registrado no empréstimo
    if (livroCheck.rows[0].usuario_emprestimo !== parseInt(usuario_id)) {
      return res.status(403).json({
        error:
          "Você não tem permissão para devolver este livro, pois ele está emprestado para outro usuário.",
      });
    }

    // 2. Se passou na validação, limpa os campos normalmente
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
