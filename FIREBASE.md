# Firebase para DOBLECERO

Para que login, registro, roles y turnos funcionen:

1. En Firebase Authentication, activa Email/Password.
2. En Firestore Database, crea la base de datos.
3. En Authentication > Settings > Authorized domains, usa `localhost` si vas a probar localmente.
4. No abras la web con `file://`. Usala desde `http://localhost` o desde un hosting.
5. Pega o revisa tu configuracion real en `js/firebase-config.js`.

Colecciones usadas:

- `users`
- `appointments`
- `appointmentSlots`

Reglas simples para probar:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isProducer() {
      return signedIn() && userDoc().data.role == "producer";
    }

    match /users/{userId} {
      allow create: if signedIn() && request.auth.uid == userId;
      allow read, update: if signedIn() && (request.auth.uid == userId || isProducer());
    }

    match /appointments/{appointmentId} {
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow read: if signedIn() && (resource.data.userId == request.auth.uid || isProducer());
      allow update: if isProducer();
      allow delete: if isProducer();
    }

    match /appointmentSlots/{slotId} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isProducer();
    }
  }
}
```

`users/{uid}` guarda:

```json
{
  "uid": "id-del-usuario",
  "name": "Nombre",
  "email": "email@dominio.com",
  "role": "artist",
  "createdAt": "serverTimestamp"
}
```

`appointments/{id}` guarda:

```json
{
  "userId": "id-del-usuario",
  "userName": "Nombre",
  "userEmail": "email@dominio.com",
  "role": "artist",
  "service": "Grabacion",
  "artistName": "Nombre artistico",
  "date": "2026-06-23",
  "time": "18:00",
  "notes": "Detalles del proyecto",
  "status": "pendiente",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`appointmentSlots/{fecha_hora}` guarda solo la disponibilidad del horario:

```json
{
  "appointmentId": "id-del-turno",
  "userId": "id-del-usuario",
  "date": "2026-06-23",
  "time": "18:00",
  "createdAt": "serverTimestamp"
}
```
