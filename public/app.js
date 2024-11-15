document.addEventListener("DOMContentLoaded", () => {
  const appointmentForm = document.getElementById("appointmentForm");
  const clientNameInput = document.getElementById("clientName");
  const appointmentDateInput = document.getElementById("appointmentDate");
  const appointmentTimeInput = document.getElementById("appointmentTime");
  const appointmentsDiv = document.getElementById("appointments");
  const calendarContainer = document.getElementById("calendar-container");
  let editMode = false;
  let editId = null;

  const calendarEl = document.getElementById("calendar");
  let calendar;
  if (calendarEl) {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "pt-br",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      dateClick: function (info) {
        appointmentDateInput.value = info.dateStr;
      },
    });
    calendar.render();
  }

  const fetchAppointments = () => {
    fetch("http://localhost:3000/appointments")
      .then((response) => response.json())
      .then((appointments) => {
        appointmentsDiv.innerHTML = "";
        calendar.removeAllEvents();
        appointments.forEach((appointment) => {
          const appointmentDiv = document.createElement("div");
          appointmentDiv.classList.add("appointment");
          appointmentDiv.innerHTML = `
            <span>${appointment.client_name} - ${new Date(
            appointment.appointment_time
          ).toLocaleString()}</span>
            <div>
              <button class="complete" onclick="updateStatus(${
                appointment.id
              }, 'concluído')">
                <i class="fas fa-check"></i>
              </button>
              <button class="delete" onclick="deleteAppointment(${
                appointment.id
              })">
                <i class="fas fa-trash"></i>
              </button>
              <button onclick="editAppointment(${appointment.id}, '${
            appointment.client_name
          }', '${appointment.appointment_time}', '${appointment.services}', ${
            appointment.duration
          })">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          `;
          if (appointment.status === "concluído") {
            appointmentDiv.classList.add("completed");
          }
          appointmentsDiv.appendChild(appointmentDiv);

          calendar.addEvent({
            title: `${appointment.client_name} - ${appointment.services}`,
            start: appointment.appointment_time,
            end: new Date(
              new Date(appointment.appointment_time).getTime() +
                appointment.duration * 60000
            ),
            color: appointment.status === "concluído" ? "#32cd32" : "#ff6347",
          });
        });
      });
  };

  fetchAppointments();

  appointmentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const clientName = clientNameInput.value;
    const appointmentDate = appointmentDateInput.value;
    const appointmentTime = appointmentTimeInput.value;
    const services = Array.from(
      document.querySelectorAll("input[name='services']:checked")
    ).map((checkbox) => checkbox.value);

    let duration = 0;
    if (services.includes("Pé e Mão")) {
      duration = 120;
    } else if (
      services.includes("Pé") ||
      services.includes("Mão") ||
      services.includes("Spa dos Pés")
    ) {
      duration = 60;
    } else if (services.includes("Sobrancelha")) {
      duration = 30;
    }

    const appointmentDateTime = new Date(
      `${appointmentDate}T${appointmentTime}`
    );
    const offset = appointmentDateTime.getTimezoneOffset();
    const adjustedDateTime = new Date(
      appointmentDateTime.getTime() - offset * 60 * 1000
    );
    const formattedAppointmentTime = adjustedDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const appointmentData = {
      client_name: clientName,
      appointment_time: formattedAppointmentTime,
      services: services,
      duration: duration,
    };

    console.log("Dados de agendamento enviados:", appointmentData);

    if (editMode) {
      fetch(`http://localhost:3000/appointments/${editId}/edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appointmentData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((error) => {
              throw new Error(error.error);
            });
          }
          editMode = false;
          editId = null;
          clientNameInput.value = "";
          appointmentTimeInput.value = "";
          fetchAppointments();
        })
        .catch((error) => {
          alert(error.message);
        });
    } else {
      fetch("http://localhost:3000/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appointmentData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((error) => {
              throw new Error(error.error);
            });
          }
          clientNameInput.value = "";
          appointmentTimeInput.value = "";
          fetchAppointments();
        })
        .catch((error) => {
          alert(error.message);
        });
    }
  });

  window.updateStatus = (id, status) => {
    fetch(`http://localhost:3000/appointments/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }).then(() => {
      fetchAppointments();
    });
  };

  window.deleteAppointment = (id) => {
    fetch(`http://localhost:3000/appointments/${id}`, {
      method: "DELETE",
    }).then(() => {
      fetchAppointments();
    });
  };

  window.editAppointment = (
    id,
    clientName,
    appointmentTime,
    services,
    duration
  ) => {
    editMode = true;
    editId = id;
    clientNameInput.value = clientName;
    appointmentDateInput.value = new Date(appointmentTime)
      .toISOString()
      .slice(0, 10);
    appointmentTimeInput.value = new Date(appointmentTime)
      .toISOString()
      .slice(11, 16);

    // Update the services checkboxes based on the provided services
    document.querySelectorAll("input[name='services']").forEach((checkbox) => {
      checkbox.checked = services.includes(checkbox.value);
    });
  };
});
