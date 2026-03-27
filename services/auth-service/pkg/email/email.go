package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

// EmailService отправляет письма через SMTP
type EmailService struct {
	host     string
	port     string
	user     string
	password string
	from     string
}

// NewEmailService создаёт новый экземпляр email сервиса
func NewEmailService(host, port, user, password, from string) *EmailService {
	return &EmailService{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		from:     from,
	}
}

// SendVerificationCode отправляет код подтверждения email
func (s *EmailService) SendVerificationCode(to, code string) error {
	subject := "Подтверждение email - CareerBond"
	body := buildVerificationEmailBody(code)
	return s.send(to, subject, body)
}

// SendPasswordResetCode отправляет код сброса пароля
func (s *EmailService) SendPasswordResetCode(to, code string) error {
	subject := "Сброс пароля - CareerBond"
	body := buildPasswordResetEmailBody(code)
	return s.send(to, subject, body)
}

// send отправляет HTML письмо
func (s *EmailService) send(to, subject, htmlBody string) error {
	if s.user == "" || s.password == "" {
		log.Printf("[EMAIL] SMTP не настроен (SMTP_USER или SMTP_PASSWORD пусты)")
		return fmt.Errorf("SMTP не настроен")
	}

	addr := s.host + ":" + s.port
	log.Printf("[EMAIL] Отправка письма на %s через %s", to, addr)

	message := buildMIMEMessage(s.from, to, subject, htmlBody)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)

	var err error
	// Для порта 465 используем TLS, для 587 — STARTTLS
	if s.port == "465" {
		err = s.sendWithTLS(addr, auth, to, message)
	} else {
		err = smtp.SendMail(addr, auth, s.from, []string{to}, []byte(message))
	}

	if err != nil {
		log.Printf("[EMAIL] Ошибка отправки на %s: %v", to, err)
		return err
	}

	log.Printf("[EMAIL] Письмо успешно отправлено на %s", to)
	return nil
}

// sendWithTLS отправляет письмо по SSL/TLS (порт 465)
func (s *EmailService) sendWithTLS(addr string, auth smtp.Auth, to string, message string) error {
	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         s.host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("ошибка TLS подключения: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("ошибка создания SMTP клиента: %w", err)
	}
	defer client.Quit()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("ошибка аутентификации SMTP: %w", err)
	}

	if err := client.Mail(s.from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = w.Write([]byte(message))
	return err
}

// buildMIMEMessage строит MIME сообщение
func buildMIMEMessage(from, to, subject, htmlBody string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("From: CareerBond <%s>\r\n", from))
	sb.WriteString(fmt.Sprintf("To: %s\r\n", to))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	sb.WriteString("\r\n")
	sb.WriteString(htmlBody)
	return sb.String()
}

// buildVerificationEmailBody строит HTML тело письма для подтверждения email
func buildVerificationEmailBody(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1e40af, #4f46e5); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">CareerBond</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0;">Система трудоустройства студентов</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1e293b; margin: 0 0 16px;">Подтверждение email</h2>
      <p style="color: #475569; margin: 0 0 24px; line-height: 1.6;">
        Для завершения регистрации введите следующий код подтверждения:
      </p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1e40af;">%s</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">
        Код действителен 15 минут. Если вы не регистрировались, проигнорируйте это письмо.
      </p>
    </div>
  </div>
</body>
</html>`, code)
}

// buildPasswordResetEmailBody строит HTML тело письма для сброса пароля
func buildPasswordResetEmailBody(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1e40af, #4f46e5); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">CareerBond</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0;">Система трудоустройства студентов</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #1e293b; margin: 0 0 16px;">Сброс пароля</h2>
      <p style="color: #475569; margin: 0 0 24px; line-height: 1.6;">
        Для сброса пароля введите следующий код:
      </p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1e40af;">%s</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">
        Код действителен 15 минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
      </p>
    </div>
  </div>
</body>
</html>`, code)
}
