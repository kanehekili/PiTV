1) Save the fingerprint of the device:
ssh-keyscan -H <hostname>.local >> ~/.ssh/known_hosts

Currently ssh pwd and sudo pwd are the same:
2) ansible-playbook -i ansible/inventory.ini ansible/pitv.yml