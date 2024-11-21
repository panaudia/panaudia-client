import time
import uuid
import datetime
import jwt
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat, PublicFormat

def make_keys():

    private_key = Ed25519PrivateKey.generate()
    private_key_str = private_key.private_bytes(encoding=Encoding.PEM, format=PrivateFormat.PKCS8, encryption_algorithm=NoEncryption())
    public_key_str = private_key.public_key().public_bytes(encoding=Encoding.PEM, format=PublicFormat.SubjectPublicKeyInfo)
    return public_key_str.decode("utf-8"), private_key_str.decode("utf-8")


def make_ticket(private_key,
                space_id,
                name,
                not_before=None,
                expires=None,
                attenuation=None,
                gain=None,
                priority=False,
                attrs=None,
                issued_at=None,
                uid=None,
                issued_by=None):

    headers, payload = headers_and_payload(space_id,
                                           name,
                                           not_before=not_before,
                                           expires=expires,
                                           attenuation=attenuation,
                                           gain=gain,
                                           priority=priority,
                                           attrs=attrs,
                                           issued_at=issued_at,
                                           uid=uid,
                                           issued_by=issued_by)

    return jwt.encode(payload, private_key, algorithm='EdDSA', headers=headers)

def headers_and_payload(space_id,
                        name,
                        not_before=None,
                        expires=None,
                        attenuation=None,
                        gain=None,
                        priority=False,
                        attrs=None,
                        issued_at=None,
                        uid=None,
                        issued_by=None):

    panaudia = {}

    if attenuation is not None:
        panaudia["attenuation"] = attenuation

    if gain is not None:
        panaudia["gain"] = gain

    if attrs is not None:
        panaudia["attrs"] = attrs

    if priority is True:
        panaudia["priority"] = True

    iat = int(time.time()) if issued_at is None else int(datetime.datetime.timestamp(issued_at))
    jti = str(uuid.uuid4()) if uid is None else uid
    nbf = int(datetime.datetime.timestamp(not_before)) if not_before is not None else None
    exp = int(datetime.datetime.timestamp(expires)) if expires is not None else None
    iss = "panaudia.com" if issued_by is None else issued_by

    headers = {
        "typ": "JWT",
        "alg": "EdDSA",
        "crv": "Ed25519",
    }

    payload = {"iat": iat,
               "iss": iss,
               "aud": space_id,
               "jti": jti,
               "preferred_username": name
               }

    if nbf is not None:
        payload["nbf"] = nbf

    if exp is not None:
        payload["exp"] = exp

    if len(panaudia) > 0:
        payload["panaudia"] = panaudia

    return headers, payload
