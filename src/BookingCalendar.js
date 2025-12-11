class BookingCalendar extends HTMLElement {
  static get observedAttributes() {
    return ["work-hours", "slot-duration", "locale", "api-url", "booked-slots"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Конфигурация по умолчанию
    this.config = {
      workHours: { start: 10, end: 21 },
      slotDuration: 30,
      locale: "ru-RU",
      apiUrl: null,
      bookedSlots: {},
    };

    // Состояние компонента
    this.state = {
      currentDate: new Date(),
      selectedDate: null,
      selectedTime: null,
      isLoading: false,
    };
  }

  connectedCallback() {
    this.loadConfig();
    this.render();
    this.setupEventListeners();
    this.loadBookedSlots();
    this.dispatchEvent(new CustomEvent("booking-calendar:ready"));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    this.loadConfig();

    if (name === "booked-slots" && newValue) {
      try {
        this.config.bookedSlots = JSON.parse(newValue);
        this.updateTimeSlots();
      } catch (e) {
        console.error("Error parsing booked-slots:", e);
      }
    }

    if (this.isConnected) {
      this.renderCalendar();
      this.updateTimeSlots();
    }
  }

  loadConfig() {
    try {
      const workHoursAttr = this.getAttribute("work-hours");
      if (workHoursAttr) {
        this.config.workHours = JSON.parse(workHoursAttr);
      }

      const slotDuration = this.getAttribute("slot-duration");
      if (slotDuration) {
        this.config.slotDuration = parseInt(slotDuration);
      }

      const locale = this.getAttribute("locale");
      if (locale) {
        this.config.locale = locale;
      }

      const apiUrl = this.getAttribute("api-url");
      if (apiUrl) {
        this.config.apiUrl = apiUrl;
      }

      const bookedSlotsAttr = this.getAttribute("booked-slots");
      if (bookedSlotsAttr) {
        this.config.bookedSlots = JSON.parse(bookedSlotsAttr);
      }
    } catch (e) {
      console.error("Error parsing attributes:", e);
    }
  }

  async loadBookedSlots() {
    if (!this.config.apiUrl) {
      this.updateTimeSlots();
      return;
    }

    try {
      this.state.isLoading = true;
      this.updateLoadingState();

      const response = await fetch(this.config.apiUrl);
      if (response.ok) {
        this.config.bookedSlots = await response.json();
      }
    } catch (error) {
      console.error("Error loading booked slots:", error);
    } finally {
      this.state.isLoading = false;
      this.updateLoadingState();
      this.updateTimeSlots();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
            <style>
                ${this.getStyles()}
            </style>
            <div class="booking-calendar">
                <div class="calendar-container">
                    <div class="calendar-header">
                        <button type="button" class="calendar-nav prev-month">‹</button>
                        <div class="calendar-title"></div>
                        <button type="button" class="calendar-nav next-month">›</button>
                    </div>
                    
                    <div class="weekdays"></div>
                    <div class="calendar-grid"></div>
                    
                    <div class="legend">
                        <div class="legend-item">
                            <div class="legend-color legend-available"></div>
                            <span>Свободно</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color legend-booked"></div>
                            <span>Занято</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color legend-non-working"></div>
                            <span>Не рабочее</span>
                        </div>
                    </div>
                </div>
                
                <div class="time-slots-container">
                    <div class="time-slots-title">Выберите время</div>
                    <div class="time-slots-grid"></div>
                </div>
                
                <div class="selected-date-time">
                    <p>Выбрано: <strong class="selected-text"></strong></p>
                </div>
                
                <div class="loading-overlay">
                    <div class="spinner"></div>
                </div>
            </div>
        `;

    this.renderCalendar();
  }

  getStyles() {
    return `
            .booking-calendar {
                position: relative;
            }

            .calendar-container {
                margin-top: 10px;
            }

            .calendar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .calendar-nav {
                background: none;
                border: 1px solid #d2d2d7;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 18px;
                color: #1d1d1f;
                font-family: inherit;
            }

            .calendar-nav:hover:not(:disabled) {
                background-color: #f5f5f7;
                border-color: #007aff;
            }

            .calendar-nav:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .calendar-title {
                font-size: 18px;
                font-weight: 600;
                color: #1d1d1f;
                text-align: center;
                flex-grow: 1;
            }

            .weekdays {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
                margin-bottom: 10px;
            }

            .weekday {
                text-align: center;
                font-size: 12px;
                color: #86868b;
                padding: 5px;
                text-transform: uppercase;
                font-weight: 500;
            }

            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
                margin-bottom: 15px;
            }

            .calendar-day {
                aspect-ratio: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                border: 1px solid transparent;
                position: relative;
                background: white;
                font-family: inherit;
            }

            .calendar-day:hover:not(.disabled):not(.past) {
                background-color: #f5f5f7;
            }

            .calendar-day.selected {
                background-color: #007aff;
                color: white;
                border-color: #007aff;
            }

            .calendar-day.disabled {
                color: #d2d2d7;
                cursor: not-allowed;
                background-color: #f5f5f7;
            }

            .calendar-day.past {
                color: #86868b;
                cursor: not-allowed;
                background-color: #f5f5f7;
            }

            .calendar-day.today .today-indicator {
                display: block;
            }

            .today-indicator {
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background-color: #007aff;
            }

            .time-slots-container {
                margin-top: 20px;
                padding: 20px;
                background-color: #f5f5f7;
                border-radius: 8px;
                display: none;
            }

            .time-slots-container.active {
                display: block;
                animation: fadeIn 0.3s ease;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .time-slots-title {
                font-size: 16px;
                font-weight: 600;
                color: #1d1d1f;
                margin-bottom: 15px;
                text-align: center;
            }

            .time-slots-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 10px;
            }

            .time-slot {
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                transition: all 0.2s;
                border: 2px solid transparent;
                background: white;
                font-family: inherit;
            }

            .time-slot:hover:not(.booked):not(.non-working):not(.past) {
                transform: translateY(-1px);
            }

            .time-slot.available {
                background-color: #d5f4e6;
                color: #00703c;
                border-color: #34d399;
            }

            .time-slot.available:hover:not(.selected) {
                background-color: #34d399;
                color: white;
            }

            .time-slot.booked {
                background-color: #fde8e8;
                color: #c53030;
                cursor: not-allowed;
                border-color: #fc8181;
            }

            .time-slot.non-working {
                background-color: #e5e7eb;
                color: #6b7280;
                cursor: not-allowed;
                border-color: #d1d5db;
            }

            .time-slot.past {
                background-color: #f5f5f7;
                color: #86868b;
                cursor: not-allowed;
                border-color: #d2d2d7;
            }

            .time-slot.selected {
                background-color: #007aff;
                color: white;
                border-color: #0056d6;
                transform: scale(1.05);
            }

            .selected-date-time {
                margin-top: 20px;
                padding: 15px;
                background-color: #f0f7ff;
                border-radius: 8px;
                border-left: 4px solid #007aff;
                display: none;
            }

            .selected-date-time.active {
                display: block;
                animation: fadeIn 0.3s ease;
            }

            .selected-date-time p {
                margin: 0;
                font-size: 14px;
            }

            .selected-date-time strong {
                color: #007aff;
            }

            .legend {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-top: 15px;
                flex-wrap: wrap;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                color: #666;
            }

            .legend-color {
                width: 15px;
                height: 15px;
                border-radius: 3px;
                border: 1px solid rgba(0,0,0,0.1);
            }

            .legend-available { background-color: #d5f4e6; border-color: #34d399; }
            .legend-booked { background-color: #fde8e8; border-color: #fc8181; }
            .legend-non-working { background-color: #e5e7eb; border-color: #d1d5db; }

            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                display: none;
                border-radius: 8px;
                z-index: 10;
            }

            .loading-overlay.active {
                display: flex;
            }

            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007aff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .error-message {
                margin-top: 10px;
                padding: 12px;
                background-color: #fde8e8;
                color: #c53030;
                border-radius: 8px;
                text-align: center;
                font-size: 14px;
                display: none;
            }

            .error-message.active {
                display: block;
            }
        `;
  }

  renderCalendar() {
    const calendarGrid = this.shadowRoot.querySelector(".calendar-grid");
    const calendarTitle = this.shadowRoot.querySelector(".calendar-title");
    const weekdays = this.shadowRoot.querySelector(".weekdays");

    // Очищаем календарь
    calendarGrid.innerHTML = "";

    // Устанавливаем заголовок месяца
    const date = this.state.currentDate;
    const formatter = new Intl.DateTimeFormat(this.config.locale, {
      month: "long",
      year: "numeric",
    });
    calendarTitle.textContent = formatter.format(date);

    // Рендерим дни недели
    this.renderWeekdays(weekdays);

    // Рендерим дни месяца
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let firstDayOfWeek = firstDay.getDay();
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const daysInMonth = lastDay.getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Пустые ячейки перед первым днем
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarGrid.appendChild(this.createDayElement(null, "disabled"));
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const isToday = dayDate.getTime() === today.getTime();
      const isPast = dayDate < today;
      const isSelected = this.state.selectedDate === this.formatDate(dayDate);

      calendarGrid.appendChild(
        this.createDayElement(
          day,
          isPast ? "past" : null,
          dayDate,
          isToday,
          isSelected
        )
      );
    }
  }

  renderWeekdays(container) {
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    container.innerHTML = weekdays
      .map((day) => `<div class="weekday">${day}</div>`)
      .join("");
  }

  createDayElement(
    day,
    className,
    date = null,
    isToday = false,
    isSelected = false
  ) {
    const dayElement = document.createElement("button");
    dayElement.type = "button";
    dayElement.className = "calendar-day";

    if (className) dayElement.classList.add(className);
    if (isToday) dayElement.classList.add("today");
    if (isSelected) dayElement.classList.add("selected");

    if (day !== null) {
      dayElement.textContent = day;
      dayElement.dataset.date = this.formatDate(date);

      if (!className && dayElement.classList.contains("past")) {
        dayElement.disabled = true;
      }

      dayElement.addEventListener("click", () =>
        this.selectDate(dayElement.dataset.date)
      );
    } else {
      dayElement.disabled = true;
    }

    if (isToday) {
      const indicator = document.createElement("div");
      indicator.className = "today-indicator";
      dayElement.appendChild(indicator);
    }

    return dayElement;
  }

  selectDate(dateString) {
    this.state.selectedDate = dateString;
    this.state.selectedTime = null;

    // Обновляем UI
    this.shadowRoot.querySelectorAll(".calendar-day").forEach((day) => {
      day.classList.remove("selected");
      if (day.dataset.date === dateString) {
        day.classList.add("selected");
      }
    });

    // Показываем слоты времени
    this.showTimeSlots(dateString);

    // Скрываем выбранное время
    this.shadowRoot
      .querySelector(".selected-date-time")
      .classList.remove("active");

    // Событие выбора даты
    this.dispatchEvent(
      new CustomEvent("date-selected", {
        detail: { date: dateString },
      })
    );
  }

  showTimeSlots(dateString) {
    const container = this.shadowRoot.querySelector(".time-slots-container");
    const grid = this.shadowRoot.querySelector(".time-slots-grid");

    container.classList.add("active");
    grid.innerHTML = "";

    const slots = this.generateTimeSlots(dateString);
    slots.forEach((slot) => grid.appendChild(slot));
  }

  generateTimeSlots(dateString) {
    const slots = [];
    const startHour = this.config.workHours.start;
    const endHour = this.config.workHours.end;
    const duration = this.config.slotDuration;
    const date = new Date(dateString);
    const now = new Date();

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        if (hour === endHour - 1 && minute + duration > 60) break;

        const timeString = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        const slotDateTime = new Date(date);
        slotDateTime.setHours(hour, minute, 0, 0);

        let className = "time-slot available";

        // Прошедшее время
        if (slotDateTime < now) {
          className = "time-slot past";
        }
        // Занятые слоты
        else if (
          this.config.bookedSlots[dateString] &&
          this.config.bookedSlots[dateString].includes(timeString)
        ) {
          className = "time-slot booked";
        }
        // Выбранный слот
        else if (this.state.selectedTime === timeString) {
          className = "time-slot available selected";
        }

        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = className;
        slot.textContent = timeString;
        slot.dataset.time = timeString;

        if (
          !className.includes("booked") &&
          !className.includes("non-working") &&
          !className.includes("past")
        ) {
          slot.addEventListener("click", () => this.selectTime(timeString));
        } else {
          slot.disabled = true;
        }

        slots.push(slot);
      }
    }

    return slots;
  }

  selectTime(timeString) {
    this.state.selectedTime = timeString;

    // Обновляем UI
    this.shadowRoot.querySelectorAll(".time-slot").forEach((slot) => {
      slot.classList.remove("selected");
      if (slot.dataset.time === timeString) {
        slot.classList.add("selected");
      }
    });

    // Показываем выбранное время
    const selectedText = this.shadowRoot.querySelector(".selected-text");
    const selectedContainer = this.shadowRoot.querySelector(
      ".selected-date-time"
    );

    selectedText.textContent = this.formatDateTime(
      this.state.selectedDate,
      timeString
    );
    selectedContainer.classList.add("active");

    // Диспатчим событие
    this.dispatchEvent(
      new CustomEvent("time-selected", {
        detail: {
          date: this.state.selectedDate,
          time: timeString,
          datetime: `${this.state.selectedDate}T${timeString}`,
        },
      })
    );

    // Обновляем скрытое поле в родительской форме
    const hiddenInput = document.getElementById("selectedDateTime");
    if (hiddenInput) {
      hiddenInput.value = `${this.state.selectedDate}T${timeString}`;
    }
  }

  updateTimeSlots() {
    if (this.state.selectedDate) {
      this.showTimeSlots(this.state.selectedDate);
    }
  }

  updateLoadingState() {
    const overlay = this.shadowRoot.querySelector(".loading-overlay");
    if (this.state.isLoading) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
    }
  }

  setupEventListeners() {
    this.shadowRoot
      .querySelector(".prev-month")
      .addEventListener("click", () => {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
        this.renderCalendar();
      });

    this.shadowRoot
      .querySelector(".next-month")
      .addEventListener("click", () => {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
        this.renderCalendar();
      });
  }

  formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  formatDateTime(dateString, timeString) {
    const date = new Date(`${dateString}T${timeString}:00`);
    const formatter = new Intl.DateTimeFormat(this.config.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    return formatter.format(date);
  }

  // Публичные методы
  setBookedSlots(slots) {
    this.config.bookedSlots = slots;
    this.updateTimeSlots();
  }

  getSelectedDateTime() {
    if (!this.state.selectedDate || !this.state.selectedTime) {
      return null;
    }
    return {
      date: this.state.selectedDate,
      time: this.state.selectedTime,
      datetime: `${this.state.selectedDate}T${this.state.selectedTime}`,
    };
  }

  reset() {
    this.state.selectedDate = null;
    this.state.selectedTime = null;
    this.state.currentDate = new Date();

    this.shadowRoot
      .querySelector(".selected-date-time")
      .classList.remove("active");
    this.shadowRoot
      .querySelector(".time-slots-container")
      .classList.remove("active");
    this.shadowRoot
      .querySelectorAll(".calendar-day.selected")
      .forEach((day) => {
        day.classList.remove("selected");
      });
    this.shadowRoot.querySelectorAll(".time-slot.selected").forEach((slot) => {
      slot.classList.remove("selected");
    });

    this.renderCalendar();
  }

  // Методы для работы с API
  refresh() {
    this.loadBookedSlots();
  }
}

// Регистрируем компонент
customElements.define("booking-calendar", BookingCalendar);
