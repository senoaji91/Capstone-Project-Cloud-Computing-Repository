from matplotlib.pyplot import axis
import requests
import json
import numpy as np
import cv2
import tensorflow as tf
import sys

image=cv2.imread(sys.argv[1])
image=cv2.cvtColor(image,cv2.COLOR_BGR2RGB)
image=cv2.resize(image,(180,180))/255
image=np.expand_dims(image,axis=0)
kitab={"0":"acne","1":'eksim',"2":"normal","3":"rosacea"}
url='http://localhost:8081/v1/models/skut_testing:predict'
data=json.dumps({'signature_name':"serving_default","instances":image.tolist()})
headers={'content-type':'application/json'}
response=requests.post(url,data=data,headers=headers)
prediction=json.loads(response.text)['predictions']
prediction=prediction[0]
result={}
for i in range(len(prediction)):
     result[kitab.get(str(i))]=prediction[i]
# with open("prediction.json", "w") as outfile:
#     json.dump(result, outfile)
sys.stdout.write(json.dumps(result))