// Importando as dependências
const express = require("express");
const mysql = require("mysql2"); // Usando mysql2
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config(); // Certifique-se de ter o .env configurado

const app = express();
const porta = process.env.PORT || 3000; // Usando a porta do .env ou a padrão

// Middleware para permitir CORS e interpretar JSON
app.use(cors());
app.use(bodyParser.json());

// Configuração da conexão com o banco de dados MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Conexão com o banco de dados
db.connect((err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err);
    return;
  }
  console.log("Conectado ao banco de dados MySQL.");
});

// Função para validar horários de agendamento
const isValidAppointmentTime = (appointmentTime) => {
  const data = new Date(appointmentTime);
  const hora = data.getHours();
  const minutos = data.getMinutes();
  const diaDeSemana = data.getDay(); // 0 (domingo) a 6 (sábado)

  // Verificar se é domingo
  if (diaDeSemana === 0) {
    return false;
  }

  // Verificar se o horário é válido (entre 10h e 19h)
  if (hora < 10 || hora >= 19) {
    return false;
  }

  // Verificar se é 00 ou 30 minutos
  if (minutos !== 0 && minutos !== 30) {
    return false;
  }

  return true;
};

// Endpoint para criar um agendamento
app.post("/appointments", (req, res) => {
  console.log("Início da criação de agendamento"); // Log para verificar se a rota foi atingida
  const { client_name, appointment_time, services, duration } = req.body;

  console.log("Dados recebidos para agendamento:", {
    client_name,
    appointment_time,
    services,
    duration,
  });

  if (!isValidAppointmentTime(appointment_time)) {
    console.error("Horário de agendamento inválido:", appointment_time); // Log de erro
    res.status(400).json({ error: "Horário de agendamento inválido." });
    return;
  }

  const startTime = new Date(appointment_time);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  console.log("Verificando conflitos de horário no banco de dados...");

  db.query(
    "SELECT * FROM appointments WHERE (appointment_time BETWEEN ? AND ?) OR (? BETWEEN appointment_time AND DATE_ADD(appointment_time, INTERVAL duration MINUTE))",
    [startTime, endTime, startTime],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar conflitos de horário:", err); // Log de erro ao consultar o banco
        res
          .status(500)
          .json({ error: "Erro ao verificar conflitos de horário." });
        return;
      }

      if (results.length > 0) {
        console.log("Horário já reservado:", { startTime, endTime }); // Log para conflito de horário
        res.status(400).json({ error: "Horário já reservado." });
        return;
      }

      console.log("Nenhum conflito encontrado. Criando agendamento...");

      const sql =
        "INSERT INTO appointments (client_name, appointment_time, services, duration) VALUES (?, ?, ?, ?)";
      db.query(
        sql,
        [client_name, appointment_time, services.join(", "), duration],
        (err, result) => {
          if (err) {
            console.error("Erro ao criar agendamento no banco de dados:", err); // Log de erro ao inserir
            res.status(500).json({ error: "Erro ao criar agendamento." });
            return;
          }
          console.log("Agendamento criado com sucesso:", result); // Log de sucesso
          res.status(201).json({ message: "Agendamento criado com sucesso." });
        }
      );
    }
  );
});

// Endpoint para editar um agendamento
app.put("/appointments/:id/edit", (req, res) => {
  const appointmentId = req.params.id;
  const { client_name, appointment_time, services, duration } = req.body;

  console.log(`Editando agendamento com ID: ${appointmentId}`);
  console.log("Dados recebidos para edição:", {
    client_name,
    appointment_time,
    services,
    duration,
  });

  if (!isValidAppointmentTime(appointment_time)) {
    console.error("Horário de agendamento inválido:", appointment_time); // Log de erro
    res.status(400).json({ error: "Horário de agendamento inválido." });
    return;
  }

  const startTime = new Date(appointment_time);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  console.log(
    "Verificando conflitos de horário no banco de dados para edição..."
  );

  db.query(
    "SELECT * FROM appointments WHERE id != ? AND ((appointment_time BETWEEN ? AND ?) OR (? BETWEEN appointment_time AND DATE_ADD(appointment_time, INTERVAL duration MINUTE)))",
    [appointmentId, startTime, endTime, startTime],
    (err, results) => {
      if (err) {
        console.error("Erro ao verificar conflitos de horário:", err); // Log de erro ao consultar o banco
        res
          .status(500)
          .json({ error: "Erro ao verificar conflitos de horário." });
        return;
      }

      if (results.length > 0) {
        console.log("Horário já reservado:", { startTime, endTime }); // Log para conflito de horário
        res.status(400).json({ error: "Horário já reservado." });
        return;
      }

      const sql =
        "UPDATE appointments SET client_name = ?, appointment_time = ?, services = ?, duration = ? WHERE id = ?";
      db.query(
        sql,
        [
          client_name,
          appointment_time,
          services.join(", "),
          duration,
          appointmentId,
        ],
        (err, result) => {
          if (err) {
            console.error("Erro ao editar agendamento no banco de dados:", err); // Log de erro ao editar
            res.status(500).json({ error: "Erro ao editar agendamento." });
            return;
          }
          console.log("Agendamento editado com sucesso:", result); // Log de sucesso
          res.status(200).json({ message: "Agendamento editado com sucesso." });
        }
      );
    }
  );
});

// Endpoint para listar todos os agendamentos
app.get("/appointments", (req, res) => {
  console.log("Buscando todos os agendamentos no banco de dados...");
  const sql = "SELECT * FROM appointments";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Erro ao buscar agendamentos:", err); // Log de erro ao consultar o banco
      res.status(500).json({ error: "Erro ao buscar agendamentos." });
      return;
    }
    const formattedResults = results.map((appointment) => ({
      ...appointment,
      appointment_time: new Date(appointment.appointment_time).toLocaleString(),
    }));
    console.log("Agendamentos encontrados:", formattedResults); // Log de sucesso ao listar
    res.status(200).json(formattedResults);
  });
});

// Endpoint para atualizar o status de um agendamento
app.put("/appointments/:id/status", (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  console.log(`Atualizando status do agendamento com ID: ${appointmentId}`);
  const sql = "UPDATE appointments SET status = ? WHERE id = ?";
  db.query(sql, [status, appointmentId], (err, result) => {
    if (err) {
      console.error("Erro ao atualizar status do agendamento:", err); // Log de erro ao atualizar
      res
        .status(500)
        .json({ error: "Erro ao atualizar status do agendamento." });
      return;
    }
    console.log("Status do agendamento atualizado com sucesso:", result); // Log de sucesso
    res
      .status(200)
      .json({ message: "Status do agendamento atualizado com sucesso." });
  });
});

// Endpoint para deletar um agendamento
app.delete("/appointments/:id", (req, res) => {
  const appointmentId = req.params.id;

  console.log(`Deletando agendamento com ID: ${appointmentId}`);
  const sql = "DELETE FROM appointments WHERE id = ?";
  db.query(sql, [appointmentId], (err, result) => {
    if (err) {
      console.error("Erro ao deletar agendamento:", err); // Log de erro ao deletar
      res.status(500).json({ error: "Erro ao deletar agendamento." });
      return;
    }
    console.log("Agendamento deletado com sucesso:", result); // Log de sucesso
    res.status(200).json({ message: "Agendamento deletado com sucesso." });
  });
});

// Rota para servir arquivos estáticos do front-end (caso esteja em produção)
app.use(express.static("public")); // Se os arquivos estiverem em 'public'

// Iniciar o servidor
app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
