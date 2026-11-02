import { useI18n } from "@/hooks/useI18n";
import type { Locale } from "@/lib/copy";

/**
 * Kiosk-scoped copy. The shared dictionary in `lib/copy.ts` is owned by the
 * foundation; these keys live here so the kiosk flow stays self-contained.
 */
const kioskCopy: Record<Locale, Record<string, string>> = {
  en: {
    "lang.label": "Choose your language",
    "welcome.title": "Welcome to the team",
    "welcome.body":
      "Apply to join the crew. It takes about five minutes — we'll ask for a photo, your details, when you can work, and your signature.",
    "welcome.point1": "Tell us about yourself",
    "welcome.point2": "Take a quick photo",
    "welcome.point3": "Pick the shifts you want",
    "welcome.point4": "Sign with your finger",
    "welcome.start": "Start my application",
    "welcome.privacy":
      "Your answers go straight to the hiring team. Nothing is shared with the next person who uses this kiosk.",

    progressLabel: "Application progress",
    "step.photo": "Photo",
    "step.details": "About you",
    "step.contact": "Contact",
    "step.availability": "Availability",
    "step.signature": "Signature",
    "step.review": "Review",

    "photo.title": "Take your photo",
    "photo.body":
      "Look at the camera and take a clear photo of your face. You can retake it as many times as you like.",
    "photo.previewAlt": "Your captured photo",
    "photo.capture": "Take photo",
    "photo.retake": "Retake photo",
    "photo.remove": "Remove photo",
    "photo.switchToBack": "Use back camera",
    "photo.switchToFront": "Use front camera",
    "photo.useFile": "Upload a photo instead",
    "photo.idle": "Starting the camera…",
    "photo.starting": "Getting the camera ready…",
    "photo.unsupported": "This device has no camera. Upload a photo instead.",
    "photo.error.permission":
      "We need camera permission to take your photo. Allow access and try again, or upload a photo instead.",
    "photo.error.generic":
      "We couldn't start the camera. Try again or upload a photo instead.",
    "photo.noteLabel": "Photo status",
    "photo.noteHint": "A photo is optional but helps the team recognise you.",
    "photo.ready": "Photo captured and ready to submit.",
    "photo.notReady": "No photo captured yet.",

    "details.title": "Tell us about you",
    "details.body":
      "These answers help the hiring team get to know you. Only your name and the position you want are required.",
    "field.name": "Full name",
    "field.preferredName": "Preferred name",
    "field.preferredNameHint": "What should we call you?",
    "field.hometown": "Hometown",
    "field.position": "Position applied for",
    "field.positionPlaceholder": "e.g. Cashier, Cook, Server",
    "field.shirtSize": "Shirt size",
    "field.hatSize": "Hat size",
    "hat.oneSize": "One size",
    "hat.sm": "S/M",
    "hat.lxl": "L/XL",
    "field.shiftsWanted": "Shifts wanted per week",
    "field.shiftsWantedHint": "How many shifts would you like each week?",
    "field.weekdayLunch": "Available for weekday lunch shifts?",
    "field.weekdayLunchHint":
      "Lunch shifts run during the day, Monday to Friday.",
    "field.hobbies": "What do you do on your day off?",
    "field.favoriteSnack": "Favorite candy or snack (brand)",
    "field.favoriteSnackPlaceholder": "e.g. Snickers, Hot Cheetos",
    "field.favoriteTeam": "Favorite sports team",
    "field.favoriteTeamPlaceholder": "e.g. LSU Tigers, Saints",
    "field.favoriteDrink": "Favorite drink",
    "field.favoriteDrinkPlaceholder": "Soda, energy drink, or coffee order",
    "field.favoriteColor": "Favorite color",
    "field.favoriteColorPlaceholder": "e.g. Navy blue",
    "field.funFact": "Fun fact",
    "field.goalHere": "Your goal here",
    "field.selectPlaceholder": "Select…",

    "contact.title": "How can we reach you?",
    "contact.body":
      "We use these details to schedule your interview and reach someone in an emergency.",
    "field.email": "Email",
    "field.phone": "Phone",
    "field.dateOfBirth": "Date of birth",
    "field.dateOfBirthHint": "Some roles have age requirements.",
    "field.emergencyContact": "Emergency contact name",
    "field.emergencyPhone": "Emergency contact phone",

    "availability.title": "When can you work?",
    "availability.body":
      "Tap every shift you can work. You can pick as many as you like.",
    "availability.day": "Day",
    "availability.am": "AM",
    "availability.pm": "PM",
    "availability.available": "Yes",
    "availability.unavailable": "No",
    "availability.selected": "{count} shifts selected",
    "availability.noneSelected": "No shifts selected",
    "weekday.wed": "Wednesday",
    "weekday.thu": "Thursday",
    "weekday.fri": "Friday",
    "weekday.sat": "Saturday",
    "weekday.sun": "Sunday",
    "weekday.mon": "Monday",
    "weekday.tue": "Tuesday",
    "kiosk.weekday.wed": "Wednesday",
    "kiosk.weekday.thu": "Thursday",
    "kiosk.weekday.fri": "Friday",
    "kiosk.weekday.sat": "Saturday",
    "kiosk.weekday.sun": "Sunday",
    "kiosk.weekday.mon": "Monday",
    "kiosk.weekday.tue": "Tuesday",

    "signature.title": "Sign your availability",
    "signature.body":
      "Draw your signature in the box with your finger or a stylus to confirm the shifts you selected.",
    "signature.canvasLabel": "Signature drawing area",
    "signature.prompt": "Draw your signature above.",
    "signature.captured": "Signature captured.",
    "signature.clear": "Clear",

    "review.title": "Check your answers",
    "review.body":
      "Review everything below. Use Back to fix anything before you submit.",
    "review.photo": "Photo",
    "review.photoReady": "Captured",
    "review.signature": "Signature",
    "review.signatureReady": "Signed",

    "success.title": "Application submitted",
    "success.body":
      "Thank you! The hiring team will review your application and reach out soon.",
    "success.next": "Start a new application",
    "success.auto":
      "This screen clears automatically so the next person starts fresh.",

    next: "Next",
    back: "Back",
    cancel: "Cancel",
    submit: "Submit application",
    submitting: "Submitting…",

    "common.none": "Not provided",
    "common.yes": "Yes",
    "common.no": "No",
    "common.retry": "Retry",

    "error.nameRequired": "Enter your full name.",
    "error.positionRequired": "Enter the position you're applying for.",
    "error.emailInvalid": "Enter a valid email address.",
    "error.phoneRequired": "Enter your phone number.",
    "error.phoneInvalid": "Enter a valid phone number.",
    "error.dobRequired": "Enter your date of birth.",
    "error.dobInvalid": "Enter a valid date of birth.",
    "error.dobPast": "Date of birth must be in the past.",
    "error.dobAge": "You must be between 14 and 100 years old.",
    "error.shiftsRange": "Enter a number of shifts between 0 and 7.",
    "error.emergencyRequired": "Enter an emergency contact name.",
    "error.emergencyPhoneRequired": "Enter an emergency contact phone.",
    "error.emergencyPhoneInvalid": "Enter a valid emergency contact phone.",
    "error.availabilityRequired": "Select at least one shift.",
    "error.signatureRequired": "Draw your signature to continue.",
    "error.submit": "We couldn't submit your application. Please try again.",
  },
  es: {
    "lang.label": "Elige tu idioma",
    "welcome.title": "Bienvenido al equipo",
    "welcome.body":
      "Solicita unirte al equipo. Toma unos cinco minutos: pediremos una foto, tus datos, cuándo puedes trabajar y tu firma.",
    "welcome.point1": "Cuéntanos sobre ti",
    "welcome.point2": "Toma una foto rápida",
    "welcome.point3": "Elige los turnos que quieres",
    "welcome.point4": "Firma con el dedo",
    "welcome.start": "Comenzar mi solicitud",
    "welcome.privacy":
      "Tus respuestas van directo al equipo de contratación. Nada se comparte con la siguiente persona que use este quiosco.",

    progressLabel: "Progreso de la solicitud",
    "step.photo": "Foto",
    "step.details": "Sobre ti",
    "step.contact": "Contacto",
    "step.availability": "Disponibilidad",
    "step.signature": "Firma",
    "step.review": "Revisar",

    "photo.title": "Toma tu foto",
    "photo.body":
      "Mira a la cámara y toma una foto clara de tu rostro. Puedes repetirla cuantas veces quieras.",
    "photo.previewAlt": "Tu foto capturada",
    "photo.capture": "Tomar foto",
    "photo.retake": "Repetir foto",
    "photo.remove": "Quitar foto",
    "photo.switchToBack": "Usar cámara trasera",
    "photo.switchToFront": "Usar cámara frontal",
    "photo.useFile": "Subir una foto en su lugar",
    "photo.idle": "Iniciando la cámara…",
    "photo.starting": "Preparando la cámara…",
    "photo.unsupported":
      "Este dispositivo no tiene cámara. Sube una foto en su lugar.",
    "photo.error.permission":
      "Necesitamos permiso de cámara para tomar tu foto. Permite el acceso e inténtalo de nuevo, o sube una foto.",
    "photo.error.generic":
      "No pudimos iniciar la cámara. Inténtalo de nuevo o sube una foto.",
    "photo.noteLabel": "Estado de la foto",
    "photo.noteHint":
      "La foto es opcional, pero ayuda al equipo a reconocerte.",
    "photo.ready": "Foto capturada y lista para enviar.",
    "photo.notReady": "Aún no se ha capturado ninguna foto.",

    "details.title": "Cuéntanos sobre ti",
    "details.body":
      "Estas respuestas ayudan al equipo a conocerte. Solo tu nombre y el puesto que quieres son obligatorios.",
    "field.name": "Nombre completo",
    "field.preferredName": "Nombre preferido",
    "field.preferredNameHint": "¿Cómo te llamamos?",
    "field.hometown": "Ciudad natal",
    "field.position": "Puesto solicitado",
    "field.positionPlaceholder": "p. ej. Cajero, Cocinero, Mesero",
    "field.shirtSize": "Talla de camiseta",
    "field.hatSize": "Talla de gorra",
    "hat.oneSize": "Talla única",
    "hat.sm": "S/M",
    "hat.lxl": "L/XL",
    "field.shiftsWanted": "Turnos por semana",
    "field.shiftsWantedHint": "¿Cuántos turnos quieres cada semana?",
    "field.weekdayLunch": "¿Disponible para turnos de almuerzo?",
    "field.weekdayLunchHint":
      "Los turnos de almuerzo son de día, de lunes a viernes.",
    "field.hobbies": "¿Qué haces en tu día libre?",
    "field.favoriteSnack": "Dulce o snack favorito (marca)",
    "field.favoriteSnackPlaceholder": "ej. Snickers, Hot Cheetos",
    "field.favoriteTeam": "Equipo deportivo favorito",
    "field.favoriteTeamPlaceholder": "ej. LSU Tigers, Saints",
    "field.favoriteDrink": "Bebida favorita",
    "field.favoriteDrinkPlaceholder": "Refresco, bebida energética o tu café",
    "field.favoriteColor": "Color favorito",
    "field.favoriteColorPlaceholder": "ej. Azul marino",
    "field.funFact": "Dato curioso",
    "field.goalHere": "Tu meta aquí",
    "field.selectPlaceholder": "Selecciona…",

    "contact.title": "¿Cómo te contactamos?",
    "contact.body":
      "Usamos estos datos para programar tu entrevista y contactar a alguien en una emergencia.",
    "field.email": "Correo",
    "field.phone": "Teléfono",
    "field.dateOfBirth": "Fecha de nacimiento",
    "field.dateOfBirthHint": "Algunos puestos tienen requisitos de edad.",
    "field.emergencyContact": "Nombre del contacto de emergencia",
    "field.emergencyPhone": "Teléfono del contacto de emergencia",

    "availability.title": "¿Cuándo puedes trabajar?",
    "availability.body":
      "Toca cada turno en el que puedas trabajar. Puedes elegir todos los que quieras.",
    "availability.day": "Día",
    "availability.am": "AM",
    "availability.pm": "PM",
    "availability.available": "Sí",
    "availability.unavailable": "No",
    "availability.selected": "{count} turnos seleccionados",
    "availability.noneSelected": "Ningún turno seleccionado",
    "weekday.wed": "Miércoles",
    "weekday.thu": "Jueves",
    "weekday.fri": "Viernes",
    "weekday.sat": "Sábado",
    "weekday.sun": "Domingo",
    "weekday.mon": "Lunes",
    "weekday.tue": "Martes",
    "kiosk.weekday.wed": "Miércoles",
    "kiosk.weekday.thu": "Jueves",
    "kiosk.weekday.fri": "Viernes",
    "kiosk.weekday.sat": "Sábado",
    "kiosk.weekday.sun": "Domingo",
    "kiosk.weekday.mon": "Lunes",
    "kiosk.weekday.tue": "Martes",

    "signature.title": "Firma tu disponibilidad",
    "signature.body":
      "Dibuja tu firma en el recuadro con el dedo o un lápiz para confirmar los turnos que elegiste.",
    "signature.canvasLabel": "Área para dibujar la firma",
    "signature.prompt": "Dibuja tu firma arriba.",
    "signature.captured": "Firma capturada.",
    "signature.clear": "Borrar",

    "review.title": "Revisa tus respuestas",
    "review.body":
      "Revisa todo lo de abajo. Usa Atrás para corregir algo antes de enviar.",
    "review.photo": "Foto",
    "review.photoReady": "Capturada",
    "review.signature": "Firma",
    "review.signatureReady": "Firmada",

    "success.title": "Solicitud enviada",
    "success.body":
      "¡Gracias! El equipo de contratación revisará tu solicitud y se comunicará pronto.",
    "success.next": "Comenzar una nueva solicitud",
    "success.auto":
      "Esta pantalla se limpia automáticamente para que la siguiente persona empiece de cero.",

    next: "Siguiente",
    back: "Atrás",
    cancel: "Cancelar",
    submit: "Enviar solicitud",
    submitting: "Enviando…",

    "common.none": "No proporcionado",
    "common.yes": "Sí",
    "common.no": "No",
    "common.retry": "Reintentar",

    "error.nameRequired": "Ingresa tu nombre completo.",
    "error.positionRequired": "Ingresa el puesto al que aplicas.",
    "error.emailInvalid": "Ingresa un correo válido.",
    "error.phoneRequired": "Ingresa tu número de teléfono.",
    "error.phoneInvalid": "Ingresa un número de teléfono válido.",
    "error.dobRequired": "Ingresa tu fecha de nacimiento.",
    "error.dobInvalid": "Ingresa una fecha de nacimiento válida.",
    "error.dobPast": "La fecha de nacimiento debe ser en el pasado.",
    "error.dobAge": "Debes tener entre 14 y 100 años.",
    "error.shiftsRange": "Ingresa un número de turnos entre 0 y 7.",
    "error.emergencyRequired": "Ingresa un nombre de contacto de emergencia.",
    "error.emergencyPhoneRequired":
      "Ingresa un teléfono de contacto de emergencia.",
    "error.emergencyPhoneInvalid":
      "Ingresa un teléfono de contacto de emergencia válido.",
    "error.availabilityRequired": "Selecciona al menos un turno.",
    "error.signatureRequired": "Dibuja tu firma para continuar.",
    "error.submit": "No pudimos enviar tu solicitud. Inténtalo de nuevo.",
  },
};

/** Translate a kiosk-scoped key, interpolating `{name}` placeholders. */
export function useKioskCopy() {
  const { locale } = useI18n();
  const dict = kioskCopy[locale] ?? kioskCopy.en;
  return (key: string, vars?: Record<string, string | number>): string => {
    let value = dict[key] ?? kioskCopy.en[key] ?? key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  };
}
